# Deep links into Starr

Other apps can hand Starr a payment to make. Three forms are accepted:

| URL | Notes |
|---|---|
| `starr://send?invoice=<payload>&pop=<url>` | Starr's own scheme. `payload` is anything the Send screen accepts: BOLT11 invoice, LNURL-pay, Lightning address, Bitcoin or Spark address. |
| `lightning:<payload>?pop=<url>` / `lightning://<payload>?pop=<url>` | The generic Lightning URI used by QR codes and most wallets. |
| `bitcoin:[<address>]?lightning=<bolt11>&spark=<address>&amount=<btc>&pop=<url>` | BIP 21 / BIP 321. Starr gives the full URI to the Breez SDK, which parses it. If the URI has more than one payment method, Starr pays with Spark, then Lightning, then on-chain. |

All query values must be percent-encoded (RFC 3986). Starr decodes each value one time. Parameter names are case-insensitive.

On Android, the scheme of a link must be in lowercase. Android compares the scheme of an intent filter with case, so a `LIGHTNING:` link from another app does not get to Starr. The scanner accepts a scheme in any case.

## Navigation

A link starts a new payment. Starr closes all screens that are open (an earlier Send screen, the scanner, other modals) and opens a new Send screen on top of the Wallet tab. If a payment is sending when the link arrives, Starr opens the link after the user closes the result of that payment. If that payment fails, Starr shows the alert "Payment failed" with the reason and opens the link after the user taps OK.

On a cold start, the Send screen can open before the unlock starts the Breez SDK. Until the SDK is ready, the screen shows "Detecting type…" and Continue is disabled.

On a cold start, the link goes through the entry screen, which checks for a wallet. Without a wallet, Starr opens onboarding and ignores the link. While onboarding runs, Starr also ignores links.

Starr ignores all other links, for example `starr://receive`. On a cold start, such a link opens the entry screen.

The scanner reads a QR code and a clipboard text in the same way as a link: it opens a new Send screen, and `pop` and `returnUrl` also work.

## Amount

The `amount` of a `bitcoin:` URI goes into the amount field when the payment method that Starr selects has no amount of its own: a Bitcoin address, a Spark address, or a Spark invoice or BOLT11 invoice without an amount. Starr does not change a fixed invoice amount.

## Return to the calling app: `pop`, `returnUrl`

The two names are synonyms for the BIP 321 "Proof of Payment" parameter `pop`. It is optional.

After the payment succeeds, the confirm button of the success alert reads **Back to app**. When the user taps it, Starr opens the URL as it is. Starr does not add payment information to the URL: BIP 321 makes this optional. The calling app must confirm the payment through its own channel (for Nostr zaps, the kind-9735 receipt on the relays).

Starr does not open a URL with a scheme that can execute code, read local data, start a system action, or open Starr again (`javascript:`, `file:`, `data:`, `blob:`, `content:`, `intent:`, `tel:`, `sms:`, `mailto:`, `itms-services:`, `itms-apps:`, `app-settings:`, `starr:`, `lightning:`, `bitcoin:`). Starr then makes the payment but does not open the URL.

In a `bitcoin:` URI, the Breez SDK does not accept a `req-` parameter that it does not support, as BIP 321 specifies. This includes `req-pop`: it requires payment information, which Starr does not return. The Send screen then shows an unrecognized payment request.

Difference from BIP 321: Starr opens `http:` and `https:` URLs. BIP 321 forbids them so that the wallet does not send the IP address of the user to a web server automatically. Starr opens the URL only when the user taps the button, and Universal Links and App Links use `https:` to open installed apps.

Starr opens the URL only when the payment request on the Send screen is the request from the link. If the user changes it, the alert shows **OK**.

## Example: Nostr zap from Nostrage

```
starr://send?invoice=lnbc210n1…&returnUrl=nostrage%3A%2F%2Fzap
```

Nostrage opens this when the user taps "Pay with Starr", then watches its relays for the zap receipt and shows "Zap sent" once Starr returns it to the foreground.

## Implementation

- `app/+native-intent.tsx` receives every inbound URL. `parseSendLink()` in `src/utils/deepLink.ts` makes the payment request, and `safeReturnUrl()` checks the return URL.
- `src/stores/sendStore.ts` keeps a cold-start link for `app/index.tsx` and a request that waits for a payment. `openSend()` opens the Send screen.

Traps:

- The Send screen reads the request with `useRoute().params`, not with `useLocalSearchParams()`. Expo Router decodes the params of `useLocalSearchParams()` a second time and changes a percent-encoded return URL (expo/expo#48421). Use `useLocalSearchParams()` again only after Expo Router fixes this.
- `redirectSystemPath` must return a string for the initial URL, not a promise. With a promise, Expo Router updates its state before it mounts.
- `prepareSendPayment` of the Breez SDK does not accept a BIP 21 URI. `BreezService.payableInput()` selects the payment method, and the Send screen and the payment use it.
- The scanner can be a tab. `dismissAll()` does not close a tab, so `openSend()` also calls `navigate('/(tabs)')`. `dismissTo('/(tabs)')` does not select a tab.

## Testing on a device

```bash
# iOS simulator
xcrun simctl openurl booted "starr://send?invoice=lnbc1…&returnUrl=https%3A%2F%2Fexample.com"
xcrun simctl openurl booted "lightning:lnbc1…"
xcrun simctl openurl booted "bitcoin:?lightning=lnbc1…&pop=https%3A%2F%2Fexample.com"
# Android
adb shell am start -a android.intent.action.VIEW -d "lightning:lnbc1…"
```

On the Android emulator:

- `adb -e emu finger touch 1` gives the fingerprint for the biometric prompt.
- A cold-start link in a development build opens the dev client launcher first. Select the development server, and the app then gets the link.
- The emulator clipboard does not get text from the host. To put text in it, type the text into the field of the Send screen and press Ctrl+A and Ctrl+C: `adb shell input keycombination 113 29` and `adb shell input keycombination 113 31`.

Because `lightning` and `bitcoin` are registered schemes, iOS and Android offer Starr when another app opens such a link. On Android, the user can get a request to select a default handler the first time.
