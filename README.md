# ⭐ Starr - Lightning Wallet

A beautiful, non-custodial Bitcoin Lightning wallet for iOS and Android.

![Starr Wallet](./assets/preview.png)

## Features

- ⚡ **Instant Lightning Payments** - Send and receive Bitcoin in seconds
- 🔐 **Non-Custodial** - You control your keys, your coins
- 🛡️ **Secure Backups** - Automatic encrypted channel state backups
- 🌐 **Multi-LSP Support** - Redundant liquidity providers for reliability
- 🎨 **Beautiful UI** - Cosmic dark theme with smooth animations
- 📱 **Cross-Platform** - iOS and Android from a single codebase

## Architecture

Starr is built with Lightning Network integration using:

### Current Implementation
- **LDK (Lightning Development Kit)** via LDK Node - Primary implementation
- **LND (Lightning Network Daemon)** - Fallback option for remote nodes
- REST API mode: Connect to LDK Node running as a service
- Native mode: Embedded LDK Node (planned, requires native modules)

### Features
- Non-custodial Lightning wallet
- Channel management via LSP
- Invoice creation and payment
- Payment history tracking
- Secure key management

## Tech Stack

- **React Native** with Expo
- **LDK (Lightning Development Kit)** via LDK Node for Lightning Network
- **LND** as fallback option
- **Zustand** for state management
- **Expo Router** for navigation
- **TypeScript** for type safety

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/starr.git
cd starr

# Install dependencies
npm install

# Start the development server
npm start
```

### Running on Device

```bash
# iOS (requires Mac)
npm run ios

# Android
npm run android
```

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Project Structure

```
starr/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   ├── onboarding/        # Onboarding flow
│   └── ...                # Modal screens
├── src/
│   ├── components/        # Reusable components
│   │   ├── ui/           # Base UI components
│   │   └── wallet/       # Wallet-specific components
│   ├── services/          # Core services
│   │   ├── lnd/          # LND integration
│   │   ├── keychain/     # Secure key storage
│   │   ├── backup/       # Backup management
│   │   └── lsp/          # LSP management
│   ├── stores/            # Zustand state stores
│   ├── theme/             # Design system
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
└── assets/                # Images and fonts
```

## Configuration

### Lightning Network Setup

Starr uses **LDK (Lightning Development Kit)** via LDK Node as the primary Lightning implementation.

#### Option 1: LDK Node REST API (Recommended for Development)

1. Set up and run LDK Node as a separate service (see [LDK Node documentation](https://github.com/lightningdevkit/ldk-node))

2. Create a `.env` file in the root directory:

```bash
# .env file - LDK Node REST API mode
EXPO_PUBLIC_LDK_REST_URL=http://localhost:3000  # Your LDK Node REST API URL
EXPO_PUBLIC_LDK_API_KEY=your_api_key_here  # Optional, if LDK Node requires auth
EXPO_PUBLIC_LDK_NETWORK=testnet  # bitcoin, testnet, signet, or regtest
```

3. Restart your development server after adding the configuration

#### Option 2: LND Node (Fallback)

If you prefer to use LND instead:

```bash
# .env file - LND mode
EXPO_PUBLIC_LND_ENABLED=true
EXPO_PUBLIC_LND_REST_URL=https://your-lnd-node:8080
EXPO_PUBLIC_LND_MACAROON=your_macaroon_hex
EXPO_PUBLIC_NETWORK=bitcoin  # or 'testnet' for testing
```

#### Option 3: Native LDK (Future)

Native LDK integration (embedded in the app) is planned but requires native module development for iOS and Android. This will provide better performance and offline capabilities.

### Previous Implementation

The Breez SDK implementation has been archived in the `archive/breez-sdk-implementation` branch.
   - ✅ SDK initialization
   - ✅ Balance retrieval
   - ✅ Node information
   - ✅ Invoice creation and parsing
   - ✅ Payment history
   - ✅ LSP information and selection
   - ✅ Node synchronization
   - ✅ Backup functions
   - ✅ SDK shutdown

3. **Running Tests**:
   - Tap **"Run All Tests"** to execute the full test suite
   - Or use individual test buttons for specific functions
   - Results show success/error status with detailed data

4. **Troubleshooting**:
   - If tests show "Mock Mode", rebuild the app with native modules:
     ```bash
     eas build --profile development --platform ios
     ```
   - If API key tests fail, verify your `.env` file is properly configured
   - Check console logs for detailed error messages

### Bundle Identifiers

- **iOS**: `com.starwallet`
- **Android**: `com.starwallet`

## Security

### Key Management

- Seed phrases are stored in platform-native secure storage
- iOS: Keychain Services with Secure Enclave
- Android: Keystore with hardware-backed security

### Backup Strategy

1. **Automatic Cloud Backup** - Encrypted channel state to iCloud/Google Drive
2. **Local Backup** - Encrypted local file backups
3. **Manual Export** - User-controlled backup export

### Critical Notes

- **NEVER** share your recovery phrase
- Store your 24-word backup in a secure, offline location
- Enable biometric authentication for added security
- Keep auto-backup enabled to prevent fund loss

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Links

- **Website**: [starr.app](https://starr.app)
- **Support**: [support@starr.app](mailto:support@starr.app)
- **Twitter**: [@StarrWallet](https://twitter.com/StarrWallet)

---

Built with ⚡ by the Starr team

