# Breez Payments UI — Status

Reference: [Breez SDK Spark – Payment fundamentals](https://sdk-doc-spark.breez.technology/guide/payments.html)

All payment flows use the real SDK through
[BreezService](../src/services/breez/BreezService.ts). No stubs remain.

## Done

| ID | Item |
|----|------|
| parse-1 | Parse: use SDK `parse(input)`, show parsed type label in send/scan UI |
| parse-2 | Parse: show amount, description, expiry from parse result in send screen |
| send-1 | Send: prepare step (`prepareSendPayment`), show fees before send |
| send-2 | Send: fee confirmation step (Lightning vs Spark fee when both) |
| send-3 | Send: support amountless invoices (optional amount) |
| send-4 | Send: support Bitcoin address and Spark address, not only BOLT11 |
| receive-1 | Receive: receive via Bitcoin address (`onchain` mode) |
| receive-2 | Receive: receive via Spark address (`spark` mode) |
| list-1 | List payments: filters (type, status, date range) |
| list-2 | List payments: pagination |
| list-3 | List payments: payment detail screen (`getPayment` by id) |
| claim-1 | On-chain: unclaimed deposits list, manual claim with fee approval |
| claim-2 | On-chain: max deposit claim fee in settings |
| lnurl-pay | LNURL-Pay: parse, min/max sendable, optional comment, `prepareLnurlPay` |

## Open

| ID | Item |
|----|------|
| tokens-1 | Tokens: asset filter and token-aware UI. Only the `PaymentDetails.Token` case of the payment mapper exists |

## Will not do

These SDK input types are parsed but not actionable. The list is also in the
header comment of [BreezService](../src/services/breez/BreezService.ts).

| Item | Reason |
|------|--------|
| LNURL-Withdraw | Not needed for this wallet |
| LNURL-Auth | No authentication use-case |
| BOLT12 offer / invoice / invoice request | Not supported yet |
| Silent payment address | Not supported yet |

## Known limits

The Spark SDK does not supply these values, so the fields stay at zero:

- `Balance.onchain` — `getInfo()` gives no on-chain balance. The On-chain
  section of the balance UI shows zero.
- `Balance.pendingIncoming` / `pendingOutgoing` — remove the fields together
  with the Pending balances UI.

## Notes

- Ask before you implement an unclear or product decision.
