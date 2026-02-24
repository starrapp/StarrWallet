# Breez Payments UI — Implementation TODO

Reference: [Breez SDK Spark – Payment fundamentals](https://sdk-doc-spark.breez.technology/guide/payments.html)

## Status

| ID | Item | Status |
|----|------|--------|
| parse-1 | Parse: use SDK parse(input), show parsed type label in send/scan UI | Done |
| parse-2 | Parse: show amount, description, expiry from parse result in send screen | Done |
| send-1 | Send: add prepare step (prepareSendPayment), show fees before send | Done |
| send-2 | Send: fee confirmation step (Lightning vs Spark fee when both) | Done |
| send-3 | Send: support amountless invoices (optional amount) | Done |
| send-4 | Send: support Bitcoin address & Spark address (not only BOLT11) | Done (stub sendToAddress; replace with real SDK) |
| receive-1 | Receive: receive via Bitcoin address | Pending |
| receive-2 | Receive: receive via Spark address | Pending |
| list-1 | List payments: filters (type, status, date range) | Done |
| list-2 | List payments: pagination | Done |
| list-3 | List payments: payment detail screen (getPayment by id) | Done |
| claim-1 | On-chain: unclaimed deposits list + manual claim with fee approval | Pending |
| claim-2 | On-chain: max deposit claim fee in settings | Pending |
| lnurl-1 | LNURL-Pay and LNURL-Withdraw flows | Pending |
| tokens-1 | Tokens: asset filter and token-aware UI | Pending |

## Notes

- Breez service is currently a **stub**. New methods (parse, prepareSendPayment, getPayment, list filters, claim, etc.) are added to the stub so UI can be built; replace with real SDK calls when integrating.
- Unclear or product decisions: ask before implementing.
