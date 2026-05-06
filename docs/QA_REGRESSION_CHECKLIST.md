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

## Bug Validation

### B01 - Wallet currency set to Bitcoin still shows sats
- [ ] Set currency to `BTC` in Settings.
- [ ] Return to Wallet.
- [ ] Confirm total and activity amounts are displayed in BTC format.

### B02 - Privacy Policy Product links broken
- [ ] Open Settings -> Privacy Policy.
- [ ] In Product section, tap each link.
- [ ] Confirm each destination opens successfully.

### B03 - Careers link in Privacy Policy wrong
- [ ] Open Settings -> Privacy Policy -> Company section.
- [ ] Tap `Careers`.
- [ ] Confirm mail compose opens for careers contact (no dead link behavior).

### B04 - Selected currency not reflected in wallet
- [ ] Change currency to a fiat option (for example `USD`).
- [ ] Return to Wallet.
- [ ] Confirm wallet amount labels reflect selected currency mode (fiat selection + BTC fallback indicator).

### B05 - Notification icon on Wallet not functioning
- [ ] Tap bell icon on Wallet header.
- [ ] Confirm Notifications screen opens.

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
- [ ] Verify tab icons (`Wallet`, `History`, `Settings`) are clearly visible in active and inactive states.
- [ ] Verify Settings list icons are clearly visible in light mode.

### B09 - About/Blog links incorrect in Privacy context
- [ ] Open Settings -> Privacy Policy -> Company section.
- [ ] Tap `About` and confirm it opens About page at top.
- [ ] Tap `Blog` and confirm it opens the configured blog destination.

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
