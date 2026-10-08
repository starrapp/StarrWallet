import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

import { captureException } from '@/services/logging';
import type {
  Balance,
  LightningPayment,
  Invoice,
  LightningAddress,
  LnurlSuccessAction,
  TransactionStatus,
  ParsedInput,
  PrepareSendResult,
  ListPaymentsFilter,
  MaxDepositClaimFeeSetting,
  UnclaimedDeposit,
} from '@/types/wallet';

// Unsupported SDK input types (parsed but not actionable):
// - LnurlWithdraw: not needed for this wallet
// - LnurlAuth: no authentication use-case
// - Bolt12Offer / Bolt12Invoice / Bolt12InvoiceRequest: BOLT12 not yet supported
// - SilentPaymentAddress: not yet supported
// - Url: generic URL, not a payment type
import {
  AesSuccessActionDataResult_Tags,
  connect,
  defaultConfig,
  DepositClaimError_Tags,
  initLogging,
  InputType_Tags,
  ListPaymentsRequest as SdkListPaymentsRequest,
  LnurlPayRequest,
  MaxFee,
  Network,
  OnchainConfirmationSpeed,
  PaymentDetails_Tags,
  PaymentRequest,
  PaymentStatus,
  PaymentType,
  PrepareLnurlPayRequest,
  ReceivePaymentMethod,
  Seed,
  SendPaymentMethod_Tags,
  SendPaymentOptions,
  SdkEvent_Tags,
  SuccessActionProcessed_Tags,
  type BreezSdkInterface,
  type DepositClaimError,
  type InputType,
  type LightningAddressInfo,
  type ListPaymentsRequest,
  type LnurlPayRequestDetails,
  type MaxFee as MaxFeeType,
  type Payment,
  type PrepareLnurlPayResponse,
  type PrepareSendPaymentResponse,
  type LogEntry,
  type SdkEvent,
  type SuccessActionProcessed,
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
export type LightningAddressEventHandler = (address: LightningAddress | null) => void;

export interface BreezServiceConfig {
  apiKey: string;
  workingDir?: string;
  network: 'mainnet' | 'regtest';
  syncIntervalSecs?: number;
  /** Max fee for automatic on-chain deposit claiming. Applied at init. */
  maxDepositClaimFee?: MaxDepositClaimFeeSetting;
  lnurlDomain?: string;
}

type PreparedSdkResponse =
  | { lnurl: PrepareLnurlPayResponse }
  | { standard: PrepareSendPaymentResponse };

const DEFAULT_STORAGE_DIR_NAME = 'breez-sdk-spark';

const SDK_LOG_METHODS: Record<string, 'error' | 'warn' | 'info' | 'debug' | 'trace'> = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
};

class BreezServiceImpl {
  private sdk: BreezSdkInterface | null = null;
  private sdkEventListenerId: string | null = null;
  private isInitialized = false;
  /**
   * The payment the user confirmed. Send pays with this response, not a new
   * one, so the confirmed invoice and fee are the ones paid. The key stays the
   * same on a retry, so the SDK returns the first payment and does not pay twice.
   */
  private preparedSend: (PreparedSdkResponse & { id: string; idempotencyKey: string }) | null = null;
  /** Counts prepares, so a late response cannot replace the result of a newer one. */
  private prepareSeq = 0;

  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  /**
   * Tail of the lifecycle queue. `initialize` and `shutdown` run one after the
   * other, never overlapping: two connects would orphan an SDK, and a shutdown
   * starting mid-connect would let the old connection install itself afterwards.
   */
  private lifecycle: Promise<unknown> = Promise.resolve();

  /** Queues a lifecycle step behind the previous one, however that one ended. */
  private sequence<T>(step: () => Promise<T>): Promise<T> {
    const result = this.lifecycle.then(step, step);
    this.lifecycle = result.catch(() => undefined);
    return result;
  }

  initialize(mnemonic: string, config: BreezServiceConfig): Promise<void> {
    return this.sequence(() => this.connectSdk(mnemonic, config));
  }

  shutdown(): Promise<void> {
    return this.sequence(() => this.disconnectSdk());
  }

  private async connectSdk(
    mnemonic: string,
    config: BreezServiceConfig
  ): Promise<void> {
    if (this.isInitialized) return;

    const { apiKey, network, workingDir, syncIntervalSecs, maxDepositClaimFee, lnurlDomain } = config;

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

    sdkConfig.maxDepositClaimFee = this.buildMaxDepositClaimFee(maxDepositClaimFee);
    sdkConfig.lnurlDomain = lnurlDomain || undefined;

    try {
      initLogging(undefined, {
        log: (l: LogEntry) => {
          console[SDK_LOG_METHODS[l.level] ?? 'log'](`[BreezSDK][${l.level}] ${l.line}`);
        },
      }, undefined);
    } catch { }

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
  }

  private async disconnectSdk(): Promise<void> {
    if (!this.sdk) return;

    const sdk = this.sdk;
    this.sdk = null;
    this.isInitialized = false;
    this.preparedSend = null;

    try {
      if (this.sdkEventListenerId) {
        await sdk.removeEventListener(this.sdkEventListenerId);
      }
    } catch (error) {
      console.warn('[BreezService] Failed to remove event listener:', error);
    } finally {
      this.sdkEventListenerId = null;
    }

    await sdk.disconnect();
  }

  async syncNode(): Promise<void> {
    const sdk = this.requireSdk();
    await sdk.syncWallet({});
    this.assertCurrent(sdk);
    this.emit('sync');
  }

  async getBalance(): Promise<Balance> {
    const sdk = this.requireSdk();
    const info = await sdk.getInfo({ ensureSynced: false });
    this.assertCurrent(sdk);

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
        receiverIdentityPublicKey: undefined,
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
      paymentMethod: ReceivePaymentMethod.BitcoinAddress.new({ newAddress: undefined }),
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

  async checkLightningAddressAvailable(username: string): Promise<boolean> {
    const sdk = this.requireSdk();
    return sdk.checkLightningAddressAvailable({ username });
  }

  async registerLightningAddress(username: string, description: string): Promise<LightningAddress> {
    const sdk = this.requireSdk();
    const info = await sdk.registerLightningAddress({ username, description });
    this.assertCurrent(sdk);
    return this.mapLightningAddress(info);
  }

  async getLightningAddress(): Promise<LightningAddress | null> {
    const sdk = this.requireSdk();
    const info = await sdk.getLightningAddress();
    this.assertCurrent(sdk);
    return info ? this.mapLightningAddress(info) : null;
  }

  async deleteLightningAddress(): Promise<void> {
    const sdk = this.requireSdk();
    await sdk.deleteLightningAddress();
    this.assertCurrent(sdk);
  }

  async sendPreparedPayment(id: string): Promise<LightningPayment> {
    const sdk = this.requireSdk();
    const prepared = this.preparedSend;
    if (!prepared || prepared.id !== id) {
      throw new Error('Payment details changed. Review the payment again.');
    }

    let payment: LightningPayment;
    if ('lnurl' in prepared) {
      const response = await sdk.lnurlPay(LnurlPayRequest.new({
        prepareResponse: prepared.lnurl,
        idempotencyKey: prepared.idempotencyKey,
      }));
      payment = {
        ...this.mapPayment(response.payment),
        successAction: this.mapSuccessAction(response.successAction),
      };
    } else {
      const response = await sdk.sendPayment({
        prepareResponse: prepared.standard,
        // Prepare shows the medium fee. Without options the SDK pays the fast one.
        options: prepared.standard.paymentMethod.tag === SendPaymentMethod_Tags.BitcoinAddress
          ? SendPaymentOptions.BitcoinAddress.new({ confirmationSpeed: OnchainConfirmationSpeed.Medium })
          : undefined,
        idempotencyKey: prepared.idempotencyKey,
      });
      payment = this.mapPayment(response.payment);
    }

    if (this.preparedSend === prepared) {
      this.preparedSend = null;
    }
    return payment;
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
    const seq = ++this.prepareSeq;
    const raw = input.trim();
    const parsed = await sdk.parse(raw);
    this.assertSendAmount(parsed, amountSats);

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
        amount: amountSats,
        comment: comment || undefined,
        payRequest,
      }));

      return this.storePrepared(sdk, seq, { lnurl: response }, {
        paymentMethod: 'lnurl_pay',
        amountSats: response.amountSats,
        feeSats: response.feeSats,
        description: payRequest.domain,
      });
    }

    // Standard flow
    const prepareResponse = await this.prepareSendPaymentResponse(raw, amountSats);
    const method = prepareResponse.paymentMethod;

    if (method.tag === SendPaymentMethod_Tags.Bolt11Invoice) {
      const details = method.inner;
      const fee = (details.lightningFeeSats ?? 0n) + (details.sparkTransferFeeSats ?? 0n);
      return this.storePrepared(sdk, seq, { standard: prepareResponse }, {
        paymentMethod: 'lightning',
        amountSats: prepareResponse.amount,
        feeSats: fee,
        description: details.invoiceDetails.description,
      });
    }

    if (method.tag === SendPaymentMethod_Tags.BitcoinAddress) {
      const feeQuote = method.inner.feeQuote?.speedMedium?.userFeeSat;
      if (feeQuote == null) {
        throw new Error('Could not estimate on-chain fee. Please try again.');
      }
      return this.storePrepared(sdk, seq, { standard: prepareResponse }, {
        paymentMethod: 'onchain',
        amountSats: prepareResponse.amount,
        feeSats: feeQuote,
      });
    }

    if (method.tag === SendPaymentMethod_Tags.SparkAddress) {
      return this.storePrepared(sdk, seq, { standard: prepareResponse }, {
        paymentMethod: 'spark_transfer',
        amountSats: prepareResponse.amount,
        feeSats: method.inner.fee,
      });
    }

    if (method.tag === SendPaymentMethod_Tags.SparkInvoice) {
      return this.storePrepared(sdk, seq, { standard: prepareResponse }, {
        paymentMethod: 'spark_transfer',
        amountSats: prepareResponse.amount,
        feeSats: method.inner.fee,
        description: method.inner.sparkInvoiceDetails.description,
      });
    }

    throw new Error('Unsupported payment method');
  }

  async listPayments(filter?: ListPaymentsFilter): Promise<LightningPayment[]> {
    const sdk = this.requireSdk();

    const response = await sdk.listPayments(this.toSdkListPaymentsRequest(filter));
    this.assertCurrent(sdk);
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

  async listUnclaimedDeposits(): Promise<UnclaimedDeposit[]> {
    const sdk = this.requireSdk();
    const response = await sdk.listUnclaimedDeposits({});
    this.assertCurrent(sdk);
    return response.deposits.map((d) => ({
      txid: d.txid,
      vout: d.vout,
      amountSats: d.amountSats,
      claimError: d.claimError ? this.formatClaimError(d.claimError) : undefined,
      requiredFeeSats: d.claimError?.tag === DepositClaimError_Tags.MaxDepositClaimFeeExceeded
        ? d.claimError.inner.requiredFeeSats
        : undefined,
    }));
  }

  async claimDeposit(txid: string, vout: number, maxFeeSats?: bigint): Promise<void> {
    const sdk = this.requireSdk();

    try {
      await sdk.claimDeposit({
        txid,
        vout,
        maxFee: maxFeeSats != null ? MaxFee.Fixed.new({ amount: maxFeeSats }) : undefined,
      });
    } catch (error: any) {
      console.error('[BreezService] claimDeposit failed:', error);
      captureException(error);
      const message = error?.inner?.[0] ?? error?.message ?? 'Unknown error';
      throw new Error(message);
    }
  }

  on(event: 'payment', handler: PaymentEventHandler): void;
  on(event: 'sync', handler: SyncEventHandler): void;
  on(event: 'lightningAddress', handler: LightningAddressEventHandler): void;
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

  private formatClaimError(error: DepositClaimError): string {
    switch (error.tag) {
      case DepositClaimError_Tags.MaxDepositClaimFeeExceeded:
        return `Fee too high (${error.inner.requiredFeeSats} sats required)`;
      case DepositClaimError_Tags.MissingUtxo:
        return 'UTXO not found';
      case DepositClaimError_Tags.Generic:
        return error.inner.message;
      default:
        return 'Unknown claim error';
    }
  }

  private buildMaxDepositClaimFee(setting?: MaxDepositClaimFeeSetting): MaxFeeType | undefined {
    if (!setting) return undefined;
    // MaxFee.Fixed(0) effectively prevents any auto-claim (fee always exceeds 0).
    if (setting.type === 'disabled') return MaxFee.Fixed.new({ amount: 0n });
    switch (setting.type) {
      case 'conservative':
        return MaxFee.Rate.new({ satPerVbyte: 1n });
      case 'network_recommended':
        return MaxFee.NetworkRecommended.new({
          leewaySatPerVbyte: BigInt(setting.leewaySatPerVbyte ?? 1),
        });
      case 'rate':
        return MaxFee.Rate.new({ satPerVbyte: BigInt(setting.satPerVbyte ?? 10) });
      case 'fixed':
        return MaxFee.Fixed.new({ amount: BigInt(setting.amountSats ?? 1000) });
      default:
        return undefined;
    }
  }

  private requireSdk(): BreezSdkInterface {
    if (!this.sdk || !this.isInitialized) {
      throw new Error('Breez SDK not initialized');
    }
    return this.sdk;
  }

  /**
   * Refuses a result computed by an SDK that has since been replaced.
   *
   * `requireSdk` only guards the start of a call; one already awaiting the native
   * SDK when the wallet is removed or swapped still resolves. Turning that into
   * an error keeps it out of the store, whose existing `catch` branches already
   * clear the loading flags. Applied to the calls whose answers the store keeps.
   */
  private assertCurrent(sdk: BreezSdkInterface): void {
    if (this.sdk !== sdk) {
      throw new Error('Wallet was replaced');
    }
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
      case SdkEvent_Tags.LightningAddressChanged: {
        const info = event.inner.lightningAddress;
        this.emit('lightningAddress', info ? this.mapLightningAddress(info) : null);
        return;
      }
      default:
        return;
    }
  }

  /** Returns the text/plain entry of LUD-06 metadata: [["text/plain", "..."], ...]. */
  private lnurlDescription(metadataStr: string | undefined): string | undefined {
    if (!metadataStr) return undefined;
    try {
      const entries: unknown = JSON.parse(metadataStr);
      if (!Array.isArray(entries)) return undefined;
      const entry = entries.find((e) => Array.isArray(e) && e[0] === 'text/plain');
      return typeof entry?.[1] === 'string' ? entry[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private mapSuccessAction(action: SuccessActionProcessed | undefined): LnurlSuccessAction | undefined {
    if (!action) return undefined;
    switch (action.tag) {
      case SuccessActionProcessed_Tags.Message:
        return { text: action.inner.data.message };
      case SuccessActionProcessed_Tags.Url: {
        const { description, url } = action.inner.data;
        // The SDK checks only the host. Another scheme could open a different app.
        return { text: description, url: /^https?:\/\//i.test(url) ? url : undefined };
      }
      case SuccessActionProcessed_Tags.Aes: {
        const result = action.inner.result;
        return result.tag === AesSuccessActionDataResult_Tags.Decrypted
          ? { text: `${result.inner.data.description}\n${result.inner.data.plaintext}` }
          : { text: result.inner.reason };
      }
      default:
        return undefined;
    }
  }

  private mapLightningAddress(info: LightningAddressInfo): LightningAddress {
    return {
      address: info.lightningAddress,
      username: info.username,
      lnurl: info.lnurl.bech32,
    };
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
      paymentRequest: PaymentRequest.Input.new({ input: paymentRequest }),
      amount: amountSats != null ? amountSats : undefined,
      tokenIdentifier: undefined,
      conversionOptions: undefined,
      feePolicy: undefined,
    });
  }

  private assertSendAmount(parsed: InputType, amountSats?: bigint): void {
    if (amountSats != null && amountSats <= 0n) {
      throw new Error('Amount must be greater than zero');
    }

    const amountRequired =
      parsed.tag === InputType_Tags.BitcoinAddress
      || parsed.tag === InputType_Tags.SparkAddress
      || parsed.tag === InputType_Tags.SparkInvoice
      || parsed.tag === InputType_Tags.LnurlPay
      || parsed.tag === InputType_Tags.LightningAddress;

    if (amountRequired && amountSats == null) {
      throw new Error('Amount is required for this payment request');
    }
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
          description: this.lnurlDescription(details.metadataStr),
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
          description: this.lnurlDescription(details.payRequest.metadataStr),
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
    let comment: string | undefined;
    let recipient: string | undefined;
    let successAction: LnurlSuccessAction | undefined;

    if (payment.details) {
      switch (payment.details.tag) {
        case PaymentDetails_Tags.Lightning:
          description = payment.details.inner.description ?? undefined;
          invoice = payment.details.inner.invoice;
          paymentHash = payment.details.inner.htlcDetails.paymentHash;
          preimage = payment.details.inner.htlcDetails.preimage ?? undefined;
          if (payment.details.inner.lnurlPayInfo) {
            const payInfo = payment.details.inner.lnurlPayInfo;
            description ??= this.lnurlDescription(payInfo.metadata);
            recipient = payInfo.lnAddress;
            comment = payInfo.comment;
            successAction = this.mapSuccessAction(payInfo.processedSuccessAction);
          }
          // The SDK sets this metadata on each receive with a description hash.
          if (payment.details.inner.lnurlReceiveMetadata) {
            description ??= 'Received via Lightning Address';
            comment = payment.details.inner.lnurlReceiveMetadata.senderComment;
          }
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
      comment,
      recipient,
      successAction,
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

  private storePrepared(
    sdk: BreezSdkInterface,
    seq: number,
    response: PreparedSdkResponse,
    result: Omit<PrepareSendResult, 'id'>
  ): PrepareSendResult {
    this.assertCurrent(sdk);
    if (seq !== this.prepareSeq) {
      throw new Error('Payment details changed. Review the payment again.');
    }
    const id = Crypto.randomUUID();
    this.preparedSend = { ...response, id, idempotencyKey: this.generateIdempotencyKey() };
    return { id, ...result };
  }

  private generateIdempotencyKey(): string {
    return Crypto.randomUUID();
  }
}

export const BreezService = new BreezServiceImpl();
