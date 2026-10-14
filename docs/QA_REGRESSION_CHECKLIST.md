# StarrWallet QA Regression Checklist

Use this checklist with the original QA sheet to validate each bug on iOS and Android.

## Platforms

- [ ] iOS
- [ ] Android

## Device Matrix

- [ ] iPhone portrait
- [ ] iPhone landscape (where supported)
- [ ] iPad portrait
- [ ] iPad landscape
- [ ] iPad split view (roughly 1/3, 1/2, 2/3 widths)

## iPad Layout Validation

### L01 - Global layout scaling and spacing
- [ ] Confirm no screen has clipped/overlapping text in portrait or landscape.
- [ ] Confirm content uses readable max-width columns (no ultra-wide stretched forms/cards).
- [ ] Confirm large title/header areas do not overlap body content after rotation.

### L02 - History split-view behavior
- [ ] Open History on iPad landscape and verify list/detail split view appears.
- [ ] Tap different transactions and confirm right pane updates payment details.
- [ ] Confirm narrow widths fall back to push navigation to payment details.

### L03 - Onboarding responsiveness
- [ ] Verify onboarding welcome hero text does not overlap feature cards.
- [ ] Verify create/import/backup screens keep controls visible and readable in portrait/landscape.
- [ ] Verify action buttons remain fully readable with Dynamic Type increased.

### L04 - Send/Receive/Scan modal sizing
- [ ] Verify Send and Receive forms stay centered/readable on iPad with no clipped buttons.
- [ ] Verify scanner framing box resizes correctly after orientation changes.
- [ ] Verify scanner controls remain reachable in split view and landscape.

## Map Tab

### M01 - Merchant map
- [ ] Open the Map tab and confirm map tiles render (a black or grey map on
      Android means the Google Maps API key is rejected, see README).
- [ ] Confirm nearby places appear as pins and in the list below the map.
- [ ] Change the radius (5/15/30 km) and confirm the list updates.
- [ ] Search a merchant name and confirm the results replace the nearby list.
- [ ] Tap a pin and a list row, and confirm the place detail sheet opens.
- [ ] Deny location permission and confirm the screen explains the state
      instead of showing a wrong distance.

## Lightning Address

Set `EXPO_PUBLIC_BREEZ_LNURL_DOMAIN` before these tests. With an empty value, Settings and Receive show no Lightning Address controls.

### A01 - Claim, change and remove
- [ ] In Settings, open Lightning Address and type a name from `RESERVED_LIGHTNING_USERNAMES` in capital letters. Confirm "Not available" shows and Claim stays disabled.
- [ ] Type a name that is taken. Confirm "Not available".
- [ ] Type `bad/name`. Confirm the format error shows and Claim stays disabled.
- [ ] Type a free name. Confirm "Available", then Claim. Confirm the address shows in Settings and in Receive > Lightning with a QR code.
- [ ] Tap Change and type the current name. Confirm "This is your current name" and Claim stays disabled.
- [ ] Change to a different free name. Confirm the new address shows.
- [ ] Remove the address. Confirm Settings shows "Not set" and Receive shows "Get a Lightning Address".

### A02 - Restore and load failure
- [ ] Delete the wallet and import the same recovery phrase. Confirm the address comes back without a new claim.
- [ ] Start the app with no network. Confirm Settings shows "Unavailable" and the Lightning Address screen shows Retry, not the claim form.

### A03 - Payments
- [ ] Pay the address from another wallet with a comment. Confirm History shows the comment and the payment details show it under "Comment".
- [ ] Pay the address without a comment. Confirm History shows "Received via Lightning Address".
- [ ] Send to a Lightning Address. Confirm the Send screen shows the description. After the send, confirm the payment details show "To", the description and your comment.
- [ ] Send to an LNURL service that returns a success action. Confirm the message shows after the send and in the payment details.
- [ ] Type a Cyrillic comment longer than half of the comment limit. Confirm "Comment is too long" and Continue stays disabled.
- [ ] Type a comment, then change the recipient. Confirm the comment is cleared.

### A04 - Confirmed payment is the one paid
- [ ] Tap Continue, then change the address before the confirmation shows. Confirm no confirmation appears for the old address.
- [ ] Tap Continue two times fast. Confirm the button shows a spinner and only one confirmation appears.
- [ ] With the confirmation shown, scan a different QR code. Confirm the confirmation disappears.
- [ ] Confirm the fee in History equals the fee on the confirmation, for LNURL, BOLT11 and on-chain sends.
- [ ] Tap Send and turn on airplane mode at once. After the error, turn the network on and tap Send again. Confirm only one payment is made.

## Payment Links

Behavior and test commands: [DEEP_LINKS.md](DEEP_LINKS.md). Use a second wallet as the recipient. On regtest, Spark transfers work.

### P01 - No wallet
- [ ] Delete the wallet. Confirm onboarding opens.
- [ ] Start the app with a `bitcoin:`, `lightning:` and `starr://receive` link. Confirm onboarding opens and no Send screen shows.
- [ ] Open a payment link during onboarding (for example on Import). Confirm nothing changes.
- [ ] Import the wallet. Open Send from the Wallet tab. Confirm the field is empty.

### P02 - Links and navigation
- [ ] Start the app with a payment link. After the unlock, confirm Send shows the request with its type.
- [ ] With the app open, open `starr://send?invoice=`, `starr:///send/?invoice=` and `lightning:` links. Confirm each opens Send.
- [ ] Type an amount, then open the same link again. Confirm a new Send screen with an empty amount.
- [ ] Open a link while Scan is open over Send, while Receive is open and on the History tab. Confirm one Send screen opens and Cancel goes to the Wallet tab.
- [ ] Open `starr://receive` with the app open. Confirm nothing changes.

### P03 - Return to the calling app
- [ ] Pay a link with `pop=https%3A%2F%2Fexample.com%2F%3Fa%3D1%2526b`. Confirm the alert shows "Back to app" and the browser opens `https://example.com/?a=1%26b`.
- [ ] Open the same link, put a different request in the field and pay. Confirm the alert shows "OK".
- [ ] Pay a link with `pop=tel%3A%2B19005550100`. Confirm the alert shows "OK" and no dialer opens.
- [ ] Open a `bitcoin:` link with `req-pop`. Confirm the type is Unknown and Continue shows "Unrecognized payment request".

### P04 - Link during a payment
- [ ] Tap Send and open a second link at once. Confirm the result alert of the first payment shows, and the second link opens after OK.
- [ ] Turn off the network, tap Send and open a second link at once. Confirm the alert "Payment failed" with the reason, and the second link opens after OK. Turn on the network.
- [ ] Turn off the network and tap Send with no second link. Confirm the error shows under the field and no alert shows.

### P05 - BIP 21
- [ ] Open `bitcoin:<address>?spark=<spark address>&amount=0.00001`. Confirm the type is Spark address and the amount is 1000.
- [ ] Open `bitcoin:<address>?amount=0.00002`. Confirm the type is Bitcoin address, the amount is 2000 and Continue shows the fee.

### P06 - Scanner and clipboard
- [ ] Copy a `bitcoin:` link with `pop` and paste it on the Scan tab. Confirm Send has the type and the amount, and the alert after the payment shows "Back to app".
- [ ] Paste a Spark address from Send > Scan QR Code. Confirm one Send screen opens and Cancel goes to the Wallet tab.
- [ ] Paste a Bitcoin address, a `lightning:` and a `LIGHTNING:` string on the Scan tab. Confirm Send shows the type.
- [ ] Close the scanner with the cross. Confirm it goes back to the screen that opened it.

## Bug Validation

### B01 - Wallet currency set to Bitcoin still shows sats
- [ ] Set currency to `BTC` in Settings.
- [ ] Return to Wallet.
- [ ] Confirm total and activity amounts are displayed in BTC format.

### B02 - Privacy Policy link broken
The in-app Privacy Policy screen was removed. Settings now opens the policy in
the browser.
- [ ] Open Settings -> Privacy Policy.
- [ ] Confirm `https://starr.app/privacy` opens in the browser.

### B03 - Careers link wrong
`Careers` moved to the About and Support dialogs.
- [ ] Open Settings -> About, tap `Careers`.
- [ ] Open Settings -> Support, tap `Careers`.
- [ ] Confirm mail compose opens for the careers contact in both cases.

### B04 - Selected currency not reflected in wallet
- [ ] Change currency to a fiat option (for example `USD`).
- [ ] Return to Wallet.
- [ ] Confirm wallet amount labels reflect selected currency mode (fiat selection + BTC fallback indicator).

### B05 - Notification icon on Wallet not functioning
Not applicable: the bell icon and the Notifications screen were removed.
- [ ] Confirm the Wallet header has no bell icon.

### B06 - Support page 404
- [ ] Open Settings -> Support.
- [ ] Tap `Visit Support Page`.
- [ ] Confirm a valid destination opens (no 404).
- [ ] Tap `Email Support`.
- [ ] Confirm email composer opens.

### B07 - Create Wallet checkboxes pre-selected
- [ ] Open onboarding -> Create New Wallet.
- [ ] Reveal phrase.
- [ ] Confirm both acknowledgement checkboxes are unchecked by default.
- [ ] Confirm continue button stays disabled until both are checked.

### B08 - Light mode icon contrast
- [ ] Enable Light mode.
- [ ] Verify tab icons (`Wallet`, `History`, scan button, `Map`, `Settings`) are clearly visible in active and inactive states.
- [ ] Verify Settings list icons are clearly visible in light mode.

### B09 - About link incorrect
`About` moved to the Settings -> About dialog. There is no `Blog` link any more.
- [ ] Open Settings -> About.
- [ ] Tap `About` and confirm `https://starr.app/about` opens at the top of the page.
- [ ] Tap `View on GitHub` and confirm the repository opens.

### B10 - On-chain send does not proceed
- [ ] Open Send -> enter a valid on-chain address.
- [ ] Enter valid sats amount.
- [ ] Continue to confirmation.
- [ ] Confirm fee is shown and send succeeds.
- [ ] Negative tests:
  - [ ] Missing amount is blocked.
  - [ ] Zero amount is blocked.
  - [ ] Amount + fee greater than balance is blocked.

### B11 - Continue button overlaps keyboard
- [ ] On iOS, open Send form and focus input fields.
- [ ] Confirm primary action remains visible/reachable while keyboard is open.

### B12 - No visual confirmation for incoming payment
- [ ] Receive a payment while on any screen in app.
- [ ] Confirm full-screen payment received takeover appears once per payment.
- [ ] Confirm it auto-dismisses and can be dismissed by tap.

## Evidence Capture

For each bug ID:
- [ ] Pass/Fail status
- [ ] Recording URL
- [ ] Device and OS version
- [ ] Notes for any mismatch
