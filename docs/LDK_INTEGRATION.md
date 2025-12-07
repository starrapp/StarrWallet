# LDK Integration Guide

This document explains how LDK (Lightning Development Kit) and LDK Node are integrated into Starr wallet.

## Overview

Starr now uses **LDK (Lightning Development Kit)** via **LDK Node** as the primary Lightning Network implementation. LDK Node is a ready-to-go Lightning node built using LDK.

## Integration Approach

### Current Implementation: REST API Mode

We've implemented LDK Node integration using its REST API. This allows you to:

1. Run LDK Node as a separate service
2. Connect to it via HTTP from the React Native app
3. Use all Lightning Network features (invoices, payments, channels, etc.)

### Configuration

Set these environment variables in your `.env` file:

```bash
# LDK Node REST API URL
EXPO_PUBLIC_LDK_REST_URL=http://localhost:3000

# Optional: API key if LDK Node requires authentication
EXPO_PUBLIC_LDK_API_KEY=your_api_key_here

# Network (bitcoin, testnet, signet, regtest)
EXPO_PUBLIC_LDK_NETWORK=testnet
```

### LDK Node REST API Endpoints

The service uses these endpoints (based on LDK Node's REST API):

- `GET /node` - Get node information
- `GET /balance` - Get wallet balance
- `POST /invoice` - Create invoice
- `POST /payment` - Pay invoice
- `GET /payments` - List payments
- `POST /invoice/decode` - Decode invoice
- `POST /sync` - Sync node (if available)

## Future: Native Module Integration

For production mobile apps, embedding LDK Node directly in the app would provide:

- Better performance
- Offline capabilities
- No dependency on external services
- Better battery efficiency

This requires creating native modules:

### iOS (Swift)
- Create Swift bindings to LDK's Rust core
- Use LDK's C bindings or create a bridge
- Integrate with React Native via a native module

### Android (Kotlin/Java)
- Create Kotlin/Java bindings to LDK's Rust core
- Use LDK's JNI bindings
- Integrate with React Native via a native module

## Service Architecture

The LDK service (`src/services/ldk/LDKService.ts`) provides:

- `initialize(mnemonic?)` - Initialize LDK Node connection
- `getInfo()` - Get node information
- `getBalance()` - Get wallet balance
- `createInvoice()` - Create Lightning invoice
- `payInvoice()` - Pay Lightning invoice
- `listPayments()` - List payment history
- `parseInvoice()` - Parse BOLT11 invoice
- `syncNode()` - Sync with network
- `getCurrentLSP()` - Get LSP information

## Wallet Store Integration

The wallet store (`src/stores/walletStore.ts`) automatically:

1. Checks if LDK is configured (priority)
2. Falls back to LND if LDK not configured
3. Uses the appropriate service for all operations

## Testing

To test the LDK integration:

1. Set up and run LDK Node (see [LDK Node docs](https://github.com/lightningdevkit/ldk-node))
2. Configure the REST URL in `.env`
3. Start the app - it will connect to LDK Node automatically
4. Test creating invoices, making payments, etc.

## Resources

- [LDK Documentation](https://lightningdevkit.org/)
- [LDK Node GitHub](https://github.com/lightningdevkit/ldk-node)
- [LDK Node REST API](https://github.com/lightningdevkit/ldk-node#rest-api)
