import * as FileSystem from 'expo-file-system';

import type {
  Balance,
  LightningPayment,
  Invoice,
  TransactionStatus,
  ParsedInput,
  PrepareSendResult,
  ListPaymentsFilter,
  MaxDepositClaimFeeSetting,
} from '@/types/wallet';

// Unsupported SDK input types (parsed but not actionable):
// - LnurlWithdraw: not needed for this wallet
// - LnurlAuth: no authentication use-case
// - Bolt12Offer / Bolt12Invoice / Bolt12InvoiceRequest: BOLT12 not yet supported
// - SilentPaymentAddress: not yet supported
// - Url: generic URL, not a payment type
import {
  connect,
  defaultConfig,
  InputType_Tags,
  ListPaymentsRequest as SdkListPaymentsRequest,
  LnurlPayRequest,
  MaxFee,
  Network,
  PaymentDetails_Tags,
  PaymentStatus,
  PaymentType,
  PrepareLnurlPayRequest,
  ReceivePaymentMethod,
  Seed,
  SendPaymentMethod_Tags,
  SdkEvent_Tags,
  type BreezSdkInterface,
  type DepositInfo,
  type InputType,
  type ListPaymentsRequest,
  type LnurlPayRequestDetails,
  type Payment,
  type PrepareSendPaymentResponse,
  type SdkEvent,
} from '@breeztech/breez-sdk-spark-react-native';

/** Extract a readable message from Breez SDK errors (SdkError / UniffiError). */
export function formatSdkError(err: unknown): string {
  if (err != null && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    // SdkError has tag + inner[0] with the actual message
    if (typeof e.tag === 'string' && Array.isArray(e.inner) && typeof e.inner[0] === 'string') {
      return `${e.tag}: ${e.inner[0]}`;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export type PaymentEventHandler = (payment: LightningPayment) => void;
export type SyncEventHandler = () => void;
export type ConnectionEventHandler = (connected: boolean) => void;

export interface BreezServiceConfig {
  apiKey: string;
  workingDir?: string;
  network: 'mainnet' | 'regtest';
  syncIntervalSecs?: number;
  /** Max fee for automatic on-chain deposit claiming. Applied at init. */
  maxDepositClaimFee?: MaxDepositClaimFeeSetting;
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

    return {
      lightning: info.balanceSats,
      onchain: 0n,
      // TODO(starr): remove after Pending balances UI is removed.
      // Spark SDK does not expose pending incoming/outgoing balances.
      pendingIncoming: 0n,
      pendingOutgoing: 0n,
      lastUpdated: new Date(),
    };
  }

  async createInvoice(
    amountSats: bigint,
    description?: string,
    expireSeconds: number = 3600
  ): Promise<Invoice> {
    const sdk = this.requireSdk();

    const receiveResponse = await sdk.receivePayment({
      paymentMethod: ReceivePaymentMethod.Bolt11Invoice.new({
        description: description ?? 'Starr Wallet Payment',
        amountSats,
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

  async getSparkReceiveAddress(): Promise<string> {
    const sdk = this.requireSdk();
    const response = await sdk.receivePayment({
      paymentMethod: ReceivePaymentMethod.SparkAddress.new(),
    });
    return response.paymentRequest;
  }

  async sendPayment(input: string, amountSats?: bigint, comment?: string): Promise<LightningPayment> {
    const sdk = this.requireSdk();
    const raw = input.trim();
    const parsed = await sdk.parse(raw);

    // LNURL-Pay / Lightning Address → separate SDK flow
    if (parsed.tag === InputType_Tags.LnurlPay || parsed.tag === InputType_Tags.LightningAddress) {
      const payRequest: LnurlPayRequestDetails =
        parsed.tag === InputType_Tags.LightningAddress
          ? parsed.inner[0].payRequest
          : parsed.inner[0];

      if (amountSats == null) {
        throw new Error('Amount is required for LNURL-Pay');
      }

      const prepareResponse = await sdk.prepareLnurlPay(PrepareLnurlPayRequest.new({
        amountSats,
        comment: comment || undefined,
        payRequest,
      }));

      const response = await sdk.lnurlPay(LnurlPayRequest.new({
        prepareResponse,
        idempotencyKey: this.generateIdempotencyKey(),
      }));

      return this.mapPayment(response.payment);
    }

    // Standard flow: Bolt11, Bitcoin address, Spark address, Spark invoice
    const prepareResponse = await this.prepareSendPaymentResponse(raw, amountSats);

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
    amountMsat?: bigint;
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
      amountMsat: details.amountMsat,
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
    input: string,
    amountSats?: bigint,
    comment?: string,
  ): Promise<PrepareSendResult> {
    const sdk = this.requireSdk();
    const raw = input.trim();
    const parsed = await sdk.parse(raw);

    // LNURL-Pay / Lightning Address → separate SDK prepare
    if (parsed.tag === InputType_Tags.LnurlPay || parsed.tag === InputType_Tags.LightningAddress) {
      const payRequest: LnurlPayRequestDetails =
        parsed.tag === InputType_Tags.LightningAddress
          ? parsed.inner[0].payRequest
          : parsed.inner[0];

      if (amountSats == null) {
        throw new Error('Amount is required for LNURL-Pay');
      }

      const response = await sdk.prepareLnurlPay(PrepareLnurlPayRequest.new({
        amountSats,
        comment: comment || undefined,
        payRequest,
      }));

      return {
        paymentMethod: 'lnurl_pay',
        amountSats: response.amountSats,
        feeSats: response.feeSats,
        description: payRequest.domain,
      };
    }

    // Standard flow
    const prepareResponse = await this.prepareSendPaymentResponse(raw, amountSats);
    const method = prepareResponse.paymentMethod;

    if (method.tag === SendPaymentMethod_Tags.Bolt11Invoice) {
      const details = method.inner;
      const fee = (details.lightningFeeSats ?? 0n) + (details.sparkTransferFeeSats ?? 0n);
      return {
        paymentMethod: 'lightning',
        amountSats: prepareResponse.amount,
        feeSats: fee,
        description: details.invoiceDetails.description,
      };
    }

    if (method.tag === SendPaymentMethod_Tags.BitcoinAddress) {
      return {
        paymentMethod: 'onchain',
        amountSats: prepareResponse.amount,
        feeSats: method.inner.feeQuote.speedMedium.userFeeSat,
      };
    }

    if (method.tag === SendPaymentMethod_Tags.SparkAddress) {
      return {
        paymentMethod: 'spark_transfer',
        amountSats: prepareResponse.amount,
        feeSats: method.inner.fee,
      };
    }

    if (method.tag === SendPaymentMethod_Tags.SparkInvoice) {
      return {
        paymentMethod: 'spark_transfer',
        amountSats: prepareResponse.amount,
        feeSats: method.inner.fee,
        description: method.inner.sparkInvoiceDetails.description,
      };
    }

    throw new Error('Unsupported payment method');
  }

  async listPayments(filter?: ListPaymentsFilter): Promise<LightningPayment[]> {
    const sdk = this.requireSdk();

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

  async claimDeposit(txid: string, vout: number, maxFeeSats: bigint): Promise<void> {
    const sdk = this.requireSdk();

    await sdk.claimDeposit({
      txid,
      vout,
      maxFee:
        maxFeeSats > 0n
          ? MaxFee.Fixed.new({ amount: maxFeeSats })
          : undefined,
    });
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

  private buildMaxDepositClaimFee(setting?: MaxDepositClaimFeeSetting) {
    if (!setting) return undefined;
    switch (setting.type) {
      case 'disabled':
        return undefined;
      case 'conservative':
        return MaxFee.Rate.new({ satPerVbyte: 1n });
      case 'network_recommended': {
        const leeway = Math.max(0, Math.min(255, setting.leewaySatPerVbyte ?? 1));
        return MaxFee.NetworkRecommended.new({ leewaySatPerVbyte: BigInt(leeway) });
      }
      case 'rate': {
        const sat = Math.max(1, Math.min(1000, setting.satPerVbyte ?? 1));
        return MaxFee.Rate.new({ satPerVbyte: BigInt(sat) });
      }
      case 'fixed': {
        const amount = Math.max(1, Math.min(1_000_000, setting.amountSats ?? 1000));
        return MaxFee.Fixed.new({ amount: BigInt(amount) });
      }
      default:
        return undefined;
    }
  }

  private async initializeInternal(
    mnemonic: string,
    config: BreezServiceConfig
  ): Promise<void> {
    const { apiKey, network, workingDir, syncIntervalSecs, maxDepositClaimFee } = config;

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

    sdkConfig.maxDepositClaimFee = this.buildMaxDepositClaimFee(maxDepositClaimFee) ?? undefined;

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
        // returned by sendPayment.
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

  private toSdkListPaymentsRequest(filter?: ListPaymentsFilter): ListPaymentsRequest {
    const statusFilter = filter?.statusFilter?.length
      ? filter.statusFilter
          .map((status) =>
            status === 'completed'
              ? PaymentStatus.Completed
              : status === 'pending'
                ? PaymentStatus.Pending
                : PaymentStatus.Failed
          )
      : undefined;

    return SdkListPaymentsRequest.new({
      typeFilter: filter?.typeFilter?.length
        ? filter.typeFilter.map((type) =>
            type === 'send' ? PaymentType.Send : PaymentType.Receive
          )
        : undefined,
      statusFilter,
      fromTimestamp:
        filter?.fromTimestamp != null
          ? BigInt(Math.max(0, Math.floor(filter.fromTimestamp)))
          : undefined,
      toTimestamp:
        filter?.toTimestamp != null ? BigInt(Math.max(0, Math.floor(filter.toTimestamp))) : undefined,
      offset: filter?.offset != null ? Math.max(0, Math.floor(filter.offset)) : undefined,
      limit: filter?.limit != null ? Math.max(1, Math.floor(filter.limit)) : undefined,
      sortAscending: filter?.sortAscending,
    });
  }

  private async prepareSendPaymentResponse(
    paymentRequest: string,
    amountSats?: bigint
  ): Promise<PrepareSendPaymentResponse> {
    const sdk = this.requireSdk();

    return sdk.prepareSendPayment({
      paymentRequest,
      amount: amountSats != null ? amountSats : undefined,
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
          amountMsat: details.amountMsat,
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
          amount: details.amount,
          tokenIdentifier: details.tokenIdentifier,
          description: details.description,
          expiryTime: details.expiryTime,
          senderPublicKey: details.senderPublicKey,
        };
      }
      case InputType_Tags.LnurlPay: {
        const details = input.inner[0];
        return {
          type: 'lnurl_pay',
          domain: details.domain,
          commentAllowed: details.commentAllowed,
          minSendable: details.minSendable,
          maxSendable: details.maxSendable,
        };
      }
      case InputType_Tags.LightningAddress: {
        const details = input.inner[0];
        return {
          type: 'lnurl_pay',
          domain: details.payRequest.domain,
          address: details.address,
          commentAllowed: details.payRequest.commentAllowed,
          minSendable: details.payRequest.minSendable,
          maxSendable: details.payRequest.maxSendable,
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

    return {
      id: payment.id,
      type,
      status,
      amountSats: payment.amount,
      feeSats: payment.fees > 0n ? payment.fees : undefined,
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
    return new Date(Number(timestamp) * 1000);
  }

  private generateIdempotencyKey(): string {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export const BreezService = new BreezServiceImpl();
