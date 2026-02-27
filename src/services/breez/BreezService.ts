import * as FileSystem from 'expo-file-system';

import type {
  Balance,
  LightningPayment,
  Invoice,
  LSPInfo,
  NodeInfo,
  TransactionStatus,
  ParsedInput,
  PrepareSendResult,
  ListPaymentsFilter,
} from '@/types/wallet';

import {
  connect,
  defaultConfig,
  InputType_Tags,
  MaxFee,
  Network,
  PaymentDetails_Tags,
  PaymentStatus,
  PaymentType,
  ReceivePaymentMethod,
  Seed,
  SendPaymentMethod_Tags,
  SdkEvent_Tags,
  type BreezSdkInterface,
  type DepositInfo,
  type InputType,
  type ListPaymentsRequest,
  type Payment,
  type PrepareSendPaymentResponse,
  type SdkEvent,
} from '@breeztech/breez-sdk-spark-react-native';

export type PaymentEventHandler = (payment: LightningPayment) => void;
export type SyncEventHandler = () => void;
export type ConnectionEventHandler = (connected: boolean) => void;

export interface BreezServiceConfig {
  apiKey: string;
  workingDir?: string;
  network: 'mainnet' | 'regtest';
  syncIntervalSecs?: number;
}

const DEFAULT_STORAGE_DIR_NAME = 'breez-sdk-spark';

class BreezServiceImpl {
  private sdk: BreezSdkInterface | null = null;
  private sdkEventListenerId: string | null = null;
  private isInitialized = false;
  private initializingPromise: Promise<void> | null = null;

  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  async initialize(mnemonic: string, config: BreezServiceConfig): Promise<void> {
    if (this.isInitialized) return;
    if (this.initializingPromise) return this.initializingPromise;

    this.initializingPromise = this.initializeInternal(mnemonic, config)
      .finally(() => {
        this.initializingPromise = null;
      });

    return this.initializingPromise;
  }

  async shutdown(): Promise<void> {
    if (!this.sdk) return;

    const sdk = this.sdk;
    this.sdk = null;
    this.isInitialized = false;

    try {
      if (this.sdkEventListenerId) {
        await sdk.removeEventListener(this.sdkEventListenerId);
      }
    } catch (error) {
      console.warn('[BreezService] Failed to remove event listener:', error);
    } finally {
      this.sdkEventListenerId = null;
    }

    try {
      await sdk.disconnect();
    } finally {
      this.emit('connection', false);
    }
  }

  async syncNode(): Promise<void> {
    const sdk = this.requireSdk();
    await sdk.syncWallet({});
    this.emit('sync');
  }

  async getBalance(): Promise<Balance> {
    const sdk = this.requireSdk();
    const info = await sdk.getInfo({ ensureSynced: false });

    let pendingIncoming = 0;
    let pendingOutgoing = 0;

    try {
      const pending = await sdk.listPayments({
        ...this.emptyListPaymentsRequest(),
        statusFilter: [PaymentStatus.Pending],
      });

      for (const payment of pending.payments) {
        const amount = this.bigintToNumber(payment.amount) ?? 0;
        if (payment.paymentType === PaymentType.Receive) pendingIncoming += amount;
        else pendingOutgoing += amount;
      }
    } catch {
      // Keep pending balances at 0 if payments query fails.
    }

    return {
      lightning: this.bigintToNumber(info.balanceSats) ?? 0,
      onchain: 0,
      pendingIncoming,
      pendingOutgoing,
      lastUpdated: new Date(),
    };
  }

  async getNodeInfo(): Promise<NodeInfo> {
    const sdk = this.requireSdk();
    const info = await sdk.getInfo({ ensureSynced: false });

    return {
      id: info.identityPubkey,
      pubkey: info.identityPubkey,
    };
  }

  async createInvoice(
    amountSats: number,
    description?: string,
    expireSeconds: number = 3600
  ): Promise<Invoice> {
    const sdk = this.requireSdk();

    const receiveResponse = await sdk.receivePayment({
      paymentMethod: ReceivePaymentMethod.Bolt11Invoice.new({
        description: description ?? 'Starr Wallet Payment',
        amountSats: BigInt(amountSats),
        expirySecs: expireSeconds,
        paymentHash: undefined,
      }),
    });

    const parsed = await this.parseInvoice(receiveResponse.paymentRequest);
    const now = Date.now();

    return {
      bolt11: receiveResponse.paymentRequest,
      paymentHash: parsed.paymentHash,
      amountSats,
      description: parsed.description || description,
      expiresAt: new Date(now + parsed.expiry * 1000),
      createdAt: new Date(now),
    };
  }

  async getOnchainReceiveAddress(): Promise<string> {
    const sdk = this.requireSdk();
    const response = await sdk.receivePayment({
      paymentMethod: ReceivePaymentMethod.BitcoinAddress.new(),
    });
    return response.paymentRequest;
  }

  async payInvoice(bolt11: string, amountSats?: number): Promise<LightningPayment> {
    const sdk = this.requireSdk();
    const prepareResponse = await this.prepareSendPaymentResponse(bolt11, amountSats);

    if (prepareResponse.paymentMethod.tag !== SendPaymentMethod_Tags.Bolt11Invoice) {
      throw new Error('Payment request is not a Lightning invoice');
    }

    const response = await sdk.sendPayment({
      prepareResponse,
      options: undefined,
      idempotencyKey: this.generateIdempotencyKey(),
    });

    return this.mapPayment(response.payment);
  }

  async sendToAddress(
    address: string,
    amountSats: number,
    type: 'bitcoin' | 'spark'
  ): Promise<LightningPayment> {
    const sdk = this.requireSdk();
    const prepareResponse = await this.prepareSendPaymentResponse(address, amountSats);

    if (type === 'bitcoin' && prepareResponse.paymentMethod.tag !== SendPaymentMethod_Tags.BitcoinAddress) {
      throw new Error('Payment request is not a Bitcoin address');
    }

    if (type === 'spark' && prepareResponse.paymentMethod.tag !== SendPaymentMethod_Tags.SparkAddress) {
      throw new Error('Payment request is not a Spark address');
    }

    const response = await sdk.sendPayment({
      prepareResponse,
      options: undefined,
      idempotencyKey: this.generateIdempotencyKey(),
    });

    return this.mapPayment(response.payment);
  }

  async parseInvoice(bolt11: string): Promise<{
    bolt11: string;
    paymentHash: string;
    amountMsat?: number;
    description: string;
    payee: string;
    expiry: number;
  }> {
    const sdk = this.requireSdk();
    const parsed = await sdk.parse(bolt11.trim());

    if (parsed.tag !== InputType_Tags.Bolt11Invoice) {
      throw new Error('Invalid BOLT11 invoice');
    }

    const details = parsed.inner[0];

    return {
      bolt11: details.invoice.bolt11,
      paymentHash: details.paymentHash,
      amountMsat: this.bigintToNumber(details.amountMsat),
      description: details.description ?? '',
      payee: details.payeePubkey,
      expiry: Number(details.expiry),
    };
  }

  async parse(input: string): Promise<ParsedInput> {
    const raw = input.trim();
    if (!raw) return { type: 'unknown', raw: '' };

    const sdk = this.requireSdk();

    try {
      const parsed = await sdk.parse(raw);
      return this.mapParsedInput(parsed, raw);
    } catch {
      return { type: 'unknown', raw };
    }
  }

  async prepareSendPayment(
    paymentRequest: string,
    amountSats?: number
  ): Promise<PrepareSendResult> {
    const prepareResponse = await this.prepareSendPaymentResponse(paymentRequest, amountSats);
    const method = prepareResponse.paymentMethod;

    if (method.tag === SendPaymentMethod_Tags.Bolt11Invoice) {
      const details = method.inner;
      return {
        paymentMethod: 'lightning',
        amountSats: this.bigintToNumber(prepareResponse.amount) ?? 0,
        lightningFeeSats: this.bigintToNumber(details.lightningFeeSats),
        sparkTransferFeeSats: this.bigintToNumber(details.sparkTransferFeeSats),
        description: details.invoiceDetails.description,
      };
    }

    if (method.tag === SendPaymentMethod_Tags.BitcoinAddress) {
      return {
        paymentMethod: 'onchain',
        amountSats: this.bigintToNumber(prepareResponse.amount) ?? 0,
        onchainFeeSats: this.bigintToNumber(method.inner.feeQuote.speedMedium.userFeeSat),
      };
    }

    if (method.tag === SendPaymentMethod_Tags.SparkAddress) {
      return {
        paymentMethod: 'spark_transfer',
        amountSats: this.bigintToNumber(prepareResponse.amount) ?? 0,
        sparkTransferFeeSats: this.bigintToNumber(method.inner.fee),
      };
    }

    if (method.tag === SendPaymentMethod_Tags.SparkInvoice) {
      return {
        paymentMethod: 'spark_transfer',
        amountSats: this.bigintToNumber(prepareResponse.amount) ?? 0,
        sparkTransferFeeSats: this.bigintToNumber(method.inner.fee),
        description: method.inner.sparkInvoiceDetails.description,
      };
    }

    throw new Error('Unsupported payment method');
  }

  async listPayments(filter?: ListPaymentsFilter): Promise<LightningPayment[]> {
    const sdk = this.requireSdk();

    const statusFilter = filter?.statusFilter;
    if (
      statusFilter &&
      statusFilter.length > 0 &&
      statusFilter.every((status) => status === 'expired')
    ) {
      return [];
    }

    const response = await sdk.listPayments(this.toSdkListPaymentsRequest(filter));
    return response.payments.map((payment) => this.mapPayment(payment));
  }

  async getPayment(paymentId: string): Promise<LightningPayment | null> {
    const sdk = this.requireSdk();

    try {
      const response = await sdk.getPayment({ paymentId });
      return this.mapPayment(response.payment);
    } catch (error) {
      if (error instanceof Error && /not found|unknown payment/i.test(error.message)) {
        return null;
      }
      throw error;
    }
  }

  async listUnclaimedDeposits(): Promise<DepositInfo[]> {
    const sdk = this.requireSdk();
    const response = await sdk.listUnclaimedDeposits({});
    return response.deposits;
  }

  // TODO(starr): add UI for claiming unclaimed deposits:
  // 1) list via listUnclaimedDeposits() and show claimError details
  // 2) for MaxDepositClaimFeeExceeded, show requiredFeeSats and ask user confirmation
  async claimDeposit(txid: string, vout: number, maxFeeSats: number): Promise<void> {
    const sdk = this.requireSdk();

    await sdk.claimDeposit({
      txid,
      vout,
      maxFee:
        maxFeeSats > 0
          ? MaxFee.Fixed.new({ amount: BigInt(maxFeeSats) })
          : undefined,
    });
  }

  // TODO(starr): remove LSP stubs after deleting channels UI.
  async getCurrentLSP(): Promise<LSPInfo | null> {
    return null;
  }

  // TODO(starr): remove LSP stubs after deleting channels UI.
  async getAvailableLSPs(): Promise<LSPInfo[]> {
    return [];
  }

  async selectLSP(_lspId: string): Promise<void> {
    // Spark SDK does not expose LSP management APIs.
  }

  on(event: 'payment', handler: PaymentEventHandler): void;
  on(event: 'sync', handler: SyncEventHandler): void;
  on(event: 'connection', handler: ConnectionEventHandler): void;
  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.eventListeners.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: any[]): void {
    this.eventListeners.get(event)?.forEach((handler) => handler(...args));
  }

  private async initializeInternal(
    mnemonic: string,
    config: BreezServiceConfig
  ): Promise<void> {
    const { apiKey, network, workingDir, syncIntervalSecs } = config;

    if (!apiKey) {
      throw new Error('Breez API key is missing. Set EXPO_PUBLIC_BREEZ_API_KEY.');
    }

    const { storageDir, storageUri } = this.resolveStorageDir(workingDir);

    if (storageUri) {
      new FileSystem.Directory(storageUri).create({
        idempotent: true,
        intermediates: true,
      });
    }

    const sdkConfig = defaultConfig(
      network === 'mainnet' ? Network.Mainnet : Network.Regtest
    );
    sdkConfig.apiKey = apiKey;

    if (syncIntervalSecs != null) {
      sdkConfig.syncIntervalSecs = syncIntervalSecs;
    }

    const seed = Seed.Mnemonic.new({ mnemonic, passphrase: undefined });
    const sdk = await connect({
      config: sdkConfig,
      seed,
      storageDir,
    });

    const listenerId = await sdk.addEventListener({
      onEvent: async (event: SdkEvent) => {
        try {
          this.handleSdkEvent(event);
        } catch (error) {
          console.warn('[BreezService] Failed to handle SDK event:', error);
        }
      },
    });

    this.sdk = sdk;
    this.sdkEventListenerId = listenerId;
    this.isInitialized = true;

    this.emit('connection', true);
  }

  private requireSdk(): BreezSdkInterface {
    if (!this.sdk || !this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }
    return this.sdk;
  }

  private handleSdkEvent(event: SdkEvent): void {
    switch (event.tag) {
      case SdkEvent_Tags.Synced:
        this.emit('sync');
        return;
      case SdkEvent_Tags.PaymentPending:
      case SdkEvent_Tags.PaymentSucceeded:
      case SdkEvent_Tags.PaymentFailed: {
        const payment = this.mapPayment(event.inner.payment);
        // Avoid duplicating outgoing sends in UI. Outgoing sends are already
        // returned by payInvoice/sendToAddress.
        if (payment.type === 'receive') {
          this.emit('payment', payment);
        }
        return;
      }
      default:
        return;
    }
  }

  private resolveStorageDir(workingDir?: string): { storageDir: string; storageUri?: string } {
    const custom = workingDir?.trim();

    if (custom) {
      if (custom.startsWith('file://')) {
        return {
          storageDir: custom.replace(/^file:\/\//, ''),
          storageUri: custom,
        };
      }

      if (custom.startsWith('/')) {
        return {
          storageDir: custom,
          storageUri: `file://${custom}`,
        };
      }

      return { storageDir: custom };
    }

    const baseUri = FileSystem.Paths.document.uri;
    if (!baseUri) {
      throw new Error('Unable to determine app document directory for Breez storage');
    }

    const storageUri = `${baseUri.replace(/\/$/, '')}/${DEFAULT_STORAGE_DIR_NAME}`;
    return {
      storageDir: storageUri.replace(/^file:\/\//, ''),
      storageUri,
    };
  }

  private emptyListPaymentsRequest(): ListPaymentsRequest {
    return {
      typeFilter: undefined,
      statusFilter: undefined,
      assetFilter: undefined,
      paymentDetailsFilter: undefined,
      fromTimestamp: undefined,
      toTimestamp: undefined,
      offset: undefined,
      limit: undefined,
      sortAscending: undefined,
    };
  }

  private toSdkListPaymentsRequest(filter?: ListPaymentsFilter): ListPaymentsRequest {
    const request = this.emptyListPaymentsRequest();

    if (filter?.typeFilter?.length) {
      request.typeFilter = filter.typeFilter.map((type) =>
        type === 'send' ? PaymentType.Send : PaymentType.Receive
      );
    }

    if (filter?.statusFilter?.length) {
      const sdkStatuses = filter.statusFilter
        .filter((status) => status !== 'expired')
        .map((status) => {
          switch (status) {
            case 'completed':
              return PaymentStatus.Completed;
            case 'pending':
              return PaymentStatus.Pending;
            case 'failed':
              return PaymentStatus.Failed;
            default:
              return undefined;
          }
        })
        .filter((status): status is PaymentStatus => status != null);

      request.statusFilter = sdkStatuses.length > 0 ? sdkStatuses : undefined;
    }

    if (filter?.fromTimestamp != null) {
      request.fromTimestamp = BigInt(Math.max(0, Math.floor(filter.fromTimestamp)));
    }

    if (filter?.toTimestamp != null) {
      request.toTimestamp = BigInt(Math.max(0, Math.floor(filter.toTimestamp)));
    }

    if (filter?.offset != null) {
      request.offset = Math.max(0, Math.floor(filter.offset));
    }

    if (filter?.limit != null) {
      request.limit = Math.max(1, Math.floor(filter.limit));
    }

    if (filter?.sortAscending != null) {
      request.sortAscending = filter.sortAscending;
    }

    return request;
  }

  private async prepareSendPaymentResponse(
    paymentRequest: string,
    amountSats?: number
  ): Promise<PrepareSendPaymentResponse> {
    const sdk = this.requireSdk();

    return sdk.prepareSendPayment({
      paymentRequest,
      amount: amountSats != null ? BigInt(amountSats) : undefined,
      tokenIdentifier: undefined,
      conversionOptions: undefined,
      feePolicy: undefined,
    });
  }

  private mapParsedInput(input: InputType, raw: string): ParsedInput {
    switch (input.tag) {
      case InputType_Tags.Bolt11Invoice: {
        const details = input.inner[0];
        return {
          type: 'bolt11_invoice',
          bolt11: details.invoice.bolt11,
          paymentHash: details.paymentHash,
          amountMsat: this.bigintToNumber(details.amountMsat),
          description: details.description,
          payee: details.payeePubkey,
          expiry: Number(details.expiry),
        };
      }
      case InputType_Tags.BitcoinAddress:
        return {
          type: 'bitcoin_address',
          address: input.inner[0].address,
        };
      case InputType_Tags.SparkAddress:
        return {
          type: 'spark_address',
          address: input.inner[0].address,
        };
      case InputType_Tags.SparkInvoice: {
        const details = input.inner[0];
        return {
          type: 'spark_invoice',
          amount: this.bigintToNumber(details.amount),
          tokenIdentifier: details.tokenIdentifier,
          description: details.description,
          expiryTime: this.bigintToNumber(details.expiryTime),
          senderPublicKey: details.senderPublicKey,
        };
      }
      case InputType_Tags.LnurlPay: {
        const details = input.inner[0];
        return {
          type: 'lnurl_pay',
          minSendable: this.bigintToNumber(details.minSendable) ?? 0,
          maxSendable: this.bigintToNumber(details.maxSendable) ?? 0,
        };
      }
      case InputType_Tags.LightningAddress: {
        const details = input.inner[0];
        return {
          type: 'lnurl_pay',
          minSendable: this.bigintToNumber(details.payRequest.minSendable) ?? 0,
          maxSendable: this.bigintToNumber(details.payRequest.maxSendable) ?? 0,
        };
      }
      case InputType_Tags.LnurlWithdraw: {
        const details = input.inner[0];
        return {
          type: 'lnurl_withdraw',
          minWithdrawable: this.bigintToNumber(details.minWithdrawable) ?? 0,
          maxWithdrawable: this.bigintToNumber(details.maxWithdrawable) ?? 0,
        };
      }
      case InputType_Tags.Bip21: {
        const details = input.inner[0];
        for (const paymentMethod of details.paymentMethods) {
          const mapped = this.mapParsedInput(paymentMethod, raw);
          if (mapped.type !== 'unknown') {
            return mapped;
          }
        }
        return { type: 'unknown', raw };
      }
      default:
        return { type: 'unknown', raw };
    }
  }

  private mapPayment(payment: Payment): LightningPayment {
    const type = payment.paymentType === PaymentType.Receive ? 'receive' : 'send';
    const status = this.mapPaymentStatus(payment.status);
    const timestamp = this.toDate(payment.timestamp);

    let description: string | undefined;
    let invoice: string | undefined;
    let paymentHash = payment.id;
    let preimage: string | undefined;

    if (payment.details) {
      switch (payment.details.tag) {
        case PaymentDetails_Tags.Lightning:
          description = payment.details.inner.description ?? undefined;
          invoice = payment.details.inner.invoice;
          paymentHash = payment.details.inner.htlcDetails.paymentHash;
          preimage = payment.details.inner.htlcDetails.preimage ?? undefined;
          break;
        case PaymentDetails_Tags.Spark:
          description = payment.details.inner.invoiceDetails?.description ?? undefined;
          invoice = payment.details.inner.invoiceDetails?.invoice;
          if (payment.details.inner.htlcDetails) {
            paymentHash = payment.details.inner.htlcDetails.paymentHash;
            preimage = payment.details.inner.htlcDetails.preimage ?? undefined;
          }
          break;
        case PaymentDetails_Tags.Token:
          description = payment.details.inner.invoiceDetails?.description ?? undefined;
          invoice = payment.details.inner.invoiceDetails?.invoice;
          paymentHash = payment.details.inner.txHash;
          break;
        case PaymentDetails_Tags.Withdraw:
          paymentHash = payment.details.inner.txId;
          break;
        case PaymentDetails_Tags.Deposit:
          paymentHash = payment.details.inner.txId;
          break;
      }
    }

    const feeSats = this.bigintToNumber(payment.fees);

    return {
      id: payment.id,
      type,
      status,
      amountSats: this.bigintToNumber(payment.amount) ?? 0,
      feeSats: feeSats && feeSats > 0 ? feeSats : undefined,
      description,
      invoice,
      paymentHash,
      preimage,
      timestamp,
      completedAt: status === 'completed' ? timestamp : undefined,
    };
  }

  private mapPaymentStatus(status: PaymentStatus): TransactionStatus {
    switch (status) {
      case PaymentStatus.Completed:
        return 'completed';
      case PaymentStatus.Pending:
        return 'pending';
      case PaymentStatus.Failed:
      default:
        return 'failed';
    }
  }

  private toDate(timestamp: bigint): Date {
    const value = this.bigintToNumber(timestamp) ?? 0;
    return new Date(value * 1000);
  }

  private bigintToNumber(value: bigint | undefined): number | undefined {
    if (value == null) return undefined;
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (value > maxSafe) return Number.MAX_SAFE_INTEGER;
    if (value < -maxSafe) return Number.MIN_SAFE_INTEGER;
    return Number(value);
  }

  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export const BreezService = new BreezServiceImpl();
