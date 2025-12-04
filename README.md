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

Starr is built with a phased approach to Lightning integration:

### Phase 1: MVP (Current)
- **Breez SDK** for rapid Lightning development
- Automatic channel management via LSP
- Built-in on-chain/Lightning swaps

### Phase 2: Power Users (Planned)
- Remote node support (LND/CLN)
- Advanced channel management
- Custom LSP configuration

### Phase 3: Full Control (Future)
- Raw LDK integration option
- Complete node control
- Advanced routing

## Tech Stack

- **React Native** with Expo
- **Breez SDK** for Lightning
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
│   │   ├── breez/        # Breez SDK integration
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

### Breez SDK API Key

To use Starr, you'll need a Breez SDK API key:

1. Register at [https://breez.technology/sdk/](https://breez.technology/sdk/)
2. Create a `.env` file in the root directory:

```bash
# .env file
EXPO_PUBLIC_BREEZ_API_KEY=your_api_key_here
EXPO_PUBLIC_NETWORK=bitcoin  # or 'testnet' for testing
```

3. Restart your development server after adding the API key

### Testing Breez SDK

Starr includes a comprehensive test screen to verify all Breez SDK functions:

1. **Access the Test Screen**: 
   - Open the app and navigate to **Settings**
   - Scroll to the **Developer** section
   - Tap **"Test Breez SDK"**

2. **What Gets Tested**:
   - ✅ API key configuration validation
   - ✅ Native module availability (mock mode detection)
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

