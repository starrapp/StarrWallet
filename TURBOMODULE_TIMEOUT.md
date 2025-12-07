# TurboModule Invalidation Timeout

## Issue
"TurboModuleManager: Timed out waiting for modules to be invalidated"

## Root Cause
This timeout occurs at the **native level** in `RCTTurboModuleManager.mm` during Fast Refresh.
Native modules (Breez SDK, Tor, etc.) may not respond to invalidation requests quickly enough.

## Impact
- **Development only**: This warning appears during Fast Refresh in development
- **Non-critical**: Does not affect production builds
- **Does not crash the app**: It's a warning, not an error

## Solutions

### Option 1: Accept the Warning (Recommended)
This is a known limitation with certain native modules during Fast Refresh.
The warning can be safely ignored in development.

### Option 2: Disable Fast Refresh
If the warning is too disruptive, disable Fast Refresh:

1. Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
2. Select "Disable Fast Refresh"
3. Or add to `metro.config.js`:
   ```js
   module.exports = {
     // ... existing config
     resetCache: true,
   };
   ```

### Option 3: Use Full Reload Instead
Instead of Fast Refresh, use full reload:
- Shake device or press `Cmd+D` (iOS) / `Cmd+M` (Android)
- Select "Reload"

## Technical Details
- The timeout occurs in native module invalidation handlers
- Native modules must implement `RCTInvalidating` protocol properly
- JavaScript-side cleanup cannot fix native-level blocking
- This is a React Native framework limitation with certain native modules

## Related Issues
- React Native issue: https://github.com/facebook/react-native/issues/35720
- Known with modules that maintain long-lived connections (Breez SDK, Tor)

