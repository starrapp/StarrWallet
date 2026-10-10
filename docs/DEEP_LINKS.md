# Deep links into Starr

Other apps can hand Starr a payment to make. Two forms are accepted:

| URL | Notes |
|---|---|
| `starr://send?invoice=<payload>&returnUrl=<url>` | Starr's own scheme. `payload` is anything the Send screen accepts: BOLT11 invoice, LNURL-pay, Lightning address, Bitcoin or Spark address. |
| `lightning:<payload>` / `lightning://<payload>` | The generic Lightning URI used by QR codes and most wallets. Rewritten to the Send route by `app/+native-intent.tsx`. A `?returnUrl=` suffix is honored too. |

`invoice`/payload values should be URL-encoded by the caller.

## `returnUrl`

Optional. After the payment succeeds, the success alert's confirm button reads **Back to app** and opens this URL, bringing the calling app to the foreground. The value is validated by `safeReturnUrl()`: any app or web scheme is allowed except ones that could execute code, read local data, or loop back into Starr (`javascript:`, `file:`, `data:`, `blob:`, `content:`, `intent:`, `starr:`). Nothing about the payment is appended to the URL; the calling app should confirm the payment through its own channel (for Nostr zaps, the kind-9735 receipt on the relays).

## Example: Nostr zap from Nostrage

```
starr://send?invoice=lnbc210n1…&returnUrl=nostrage%3A%2F%2Fzap
```

Nostrage opens this when the user taps "Pay with Starr", then watches its relays for the zap receipt and shows "Zap sent" once Starr returns it to the foreground.

## Testing on a device

```bash
# iOS simulator
xcrun simctl openurl booted "starr://send?invoice=lnbc1…&returnUrl=https%3A%2F%2Fexample.com"
xcrun simctl openurl booted "lightning:lnbc1…"
# Android
adb shell am start -a android.intent.action.VIEW -d "lightning:lnbc1…"
```

Because `lightning` is now a registered scheme, iOS and Android will offer Starr when another app opens a `lightning:` link; on Android the user may be asked to pick a default handler the first time.
