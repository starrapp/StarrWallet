# Contributing to Starr

Thank you for your interest in contributing to Starr! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:

- **Clear title and description** of the bug
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Environment details** (OS, device, app version)
- **Screenshots or logs** if applicable
- **Severity** (critical, high, medium, low)

### Suggesting Features

We welcome feature suggestions! Please open an issue with:

- **Clear description** of the feature
- **Use case** - why this feature would be useful
- **Proposed implementation** (if you have ideas)
- **Alternatives considered** (if any)

### Pull Requests

1. **Fork the repository** and create a branch from `main`
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes**
   - Follow the existing code style
   - Write clear, self-documenting code
   - Add comments for complex logic
   - Update documentation if needed

3. **Test your changes**
   - Test on both iOS and Android if possible
   - Ensure existing functionality still works
   - Test edge cases

4. **Commit your changes**
   - Write clear, descriptive commit messages
   - Use conventional commit format:
     ```
     feat: add new feature
     fix: resolve bug in payment flow
     docs: update README
     refactor: improve code organization
     test: add unit tests
     ```

5. **Push and create a Pull Request**
   - Push to your fork
   - Create a PR with a clear title and description
   - Reference any related issues
   - Wait for review and address feedback

## Development Setup

### Prerequisites

- Node.js 20+
- Xcode (iOS) or Android Studio (Android)
- Git

The Breez SDK is a native module, so **Expo Go cannot run this app**. You need
a development client build. See the README for the details.

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/starrapp/StarrWallet.git
   cd StarrWallet
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Create a `.env` file in the root directory
   - Add the Breez SDK configuration:
     ```
     EXPO_PUBLIC_BREEZ_API_KEY=your_breez_api_key
     EXPO_PUBLIC_BREEZ_NETWORK=regtest  # Use regtest for development
     GOOGLE_MAPS_API_KEY=your_google_maps_api_key  # Android map tiles
     ```
   - All wallet variables are read in `src/config/breez.ts`

4. **Build and run**
   ```bash
   npm run ios      # expo run:ios: builds the native project, then runs it
   npm run android  # expo run:android
   ```

5. **Start Metro for a device that already has the dev client**
   ```bash
   npm start
   ```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` types - use `unknown` if necessary
- Use meaningful variable and function names

### React Native / Expo

- Follow React Native best practices
- Use functional components with hooks
- Keep components small and focused
- Extract reusable logic into custom hooks
- Use Expo Router for navigation

### File Organization

- Follow the existing project structure
- Place components in `src/components/`
- Place services in `src/services/`
- Place utilities in `src/utils/`
- Use index files for clean imports

### Naming Conventions

- **Components**: PascalCase (e.g., `BalanceCard.tsx`)
- **Files**: PascalCase for components, camelCase for utilities
- **Functions**: camelCase (e.g., `formatAmount`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_AMOUNT`)
- **Types/Interfaces**: PascalCase (e.g., `WalletState`)

### Code Formatting

- Use 2 spaces for indentation
- Use single quotes for strings (unless escaping)
- Add trailing commas in multi-line objects/arrays
- Keep lines under 100 characters when possible

## Testing

### Manual Testing

- Test on both iOS and Android
- Test on different screen sizes
- Test with different network conditions
- Test edge cases (empty states, errors, etc.)

### Checks

The repository has no test setup: `npm test` calls `jest`, but there is no jest
configuration and no test files. Run these before you submit a PR:

```bash
npx tsc --noEmit
npm run lint
```

Use [docs/QA_REGRESSION_CHECKLIST.md](./docs/QA_REGRESSION_CHECKLIST.md) for
manual device testing.

## Security Considerations

⚠️ **Important**: This is a financial application handling real Bitcoin.

- **Never commit** API keys, secrets, or private keys
- **Never commit** seed phrases or recovery phrases
- Review security implications of your changes
- Follow secure coding practices
- Report security vulnerabilities privately (see Security section)

## Project Structure

```
starr/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation screens
│   ├── onboarding/        # Onboarding flow
│   └── ...                # Modal screens
├── src/
│   ├── components/        # layout/, map/, ui/, wallet/
│   ├── config/            # breez.ts: all wallet env vars
│   ├── contexts/          # Theme and colors
│   ├── hooks/             # Shared hooks
│   ├── services/          # Core services
│   │   ├── breez/        # BreezService: the only SDK consumer
│   │   ├── btcmap/       # BTC Map API client
│   │   └── keychain/     # Seed phrase storage
│   ├── stores/            # Zustand state stores
│   ├── theme/             # Design system
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
└── assets/                # Images and fonts
```

## Areas for Contribution

We welcome contributions in these areas:

- 🐛 **Bug fixes** - Fix reported issues
- ✨ **Features** - Implement new functionality
- 📚 **Documentation** - Improve docs and README
- 🎨 **UI/UX** - Enhance the user interface
- ⚡ **Performance** - Optimize app performance
- 🔒 **Security** - Improve security practices
- 🧪 **Testing** - Add tests and improve coverage
- 🌐 **Internationalization** - Add translations
- ♿ **Accessibility** - Improve accessibility

## Review Process

1. All PRs require at least one review
2. Maintainers will review for:
   - Code quality and style
   - Functionality and correctness
   - Security implications
   - Test coverage
   - Documentation updates
3. Address review feedback promptly
4. PRs will be merged once approved

## Questions?

- Open an issue for questions or discussions
- Check existing issues and PRs first
- Be patient - maintainers are volunteers

## License

By contributing to Starr, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Starr! 🚀



