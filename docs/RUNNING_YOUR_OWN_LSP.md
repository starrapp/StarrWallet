# Running Your Own Lightning Service Provider (LSP)

This guide explains how to run your own LSP (Lightning Service Provider) instead of using Breez's managed LSP service.

## Understanding LSPs

A Lightning Service Provider (LSP) is a service that:
- Opens Lightning channels for users automatically
- Provides inbound liquidity (allows users to receive payments)
- Handles channel management and rebalancing
- Offers on-chain to Lightning swaps

## Current Architecture

Your Starr wallet currently uses **Breez SDK**, which connects to Breez's managed LSP infrastructure. The Breez SDK is designed to work specifically with Breez's LSP service and cannot be easily configured to use a different LSP.

## Options for Running Your Own LSP

### Option 1: Use Start9 Embassy Device (Easiest - Recommended)

**Start9 Embassy** is a self-hosted server device that runs **StartOS**, making it much easier to run your own LND node without manual server management.

#### Advantages of Start9

- ✅ **Pre-configured**: LND and Bitcoin Core come pre-installed
- ✅ **Web UI**: Easy management through StartOS interface
- ✅ **Automatic Updates**: Services update automatically
- ✅ **Backup System**: Built-in backup and restore
- ✅ **Tor Support**: Built-in Tor for privacy
- ✅ **No Command Line Required**: Everything through web interface

#### Step 1: Set Up Start9 Embassy

1. **Purchase/Set Up Embassy Device**:
   - Get a Start9 Embassy device (or install StartOS on compatible hardware)
   - Follow initial setup instructions from Start9

2. **Install Bitcoin Core**:
   - Open StartOS web interface
   - Go to **Marketplace**
   - Install **Bitcoin Core** service
   - Wait for blockchain sync (can take days/weeks)

3. **Install LND**:
   - In StartOS Marketplace, install **LND** service
   - LND will automatically connect to your Bitcoin Core node
   - Create wallet through the web interface

#### Step 2: Access LND Connection Details

1. **Get LND Connect URL**:
   - Navigate to **Services → LND → Properties**
   - Find **"LND Connect REST URL"** (looks like: `lndconnect://...`)
   - This URL contains all connection details (host, port, macaroon, cert)

2. **Alternative: Get Individual Credentials**:
   - **REST API URL**: Usually `https://your-embassy.local:8080` (or your Tor address)
   - **Macaroon**: Found in LND Properties (base64 encoded)
   - **TLS Certificate**: Found in LND Properties

#### Step 3: Connect to Your LND Node from Starr Wallet

Since Breez SDK doesn't support direct LND connections, you'll need to build a bridge service or use LND's REST API directly.

**Option A: Create LND REST API Service** (Recommended):

```typescript
// src/services/lnd/LNDService.ts
import { LndRestClient } from '@lightninglabs/lnrpc';

interface LNDConfig {
  restUrl: string;
  macaroon: string; // Base64 encoded
  cert?: string; // TLS certificate if needed
}

class LNDService {
  private client: LndRestClient;
  private config: LNDConfig;

  constructor(config: LNDConfig) {
    this.config = config;
    this.client = new LndRestClient({
      server: config.restUrl,
      macaroon: Buffer.from(config.macaroon, 'base64'),
      cert: config.cert ? Buffer.from(config.cert, 'base64') : undefined,
    });
  }

  async getInfo() {
    return await this.client.getInfo();
  }

  async getBalance() {
    const info = await this.client.getInfo();
    const channels = await this.client.listChannels();
    
    const totalLocal = channels.channels.reduce(
      (sum, ch) => sum + parseInt(ch.localBalance || '0'),
      0
    );
    const totalRemote = channels.channels.reduce(
      (sum, ch) => sum + parseInt(ch.remoteBalance || '0'),
      0
    );

    return {
      lightning: totalLocal,
      onchain: parseInt(info.totalBalance || '0'),
      pendingIncoming: 0,
      pendingOutgoing: 0,
      lastUpdated: new Date(),
    };
  }

  async createInvoice(amountSats: number, description?: string) {
    const invoice = await this.client.addInvoice({
      value: amountSats.toString(),
      memo: description || 'Starr Wallet Payment',
    });
    
    return {
      bolt11: invoice.paymentRequest,
      paymentHash: invoice.rHash.toString('hex'),
      amountSats,
      description,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      createdAt: new Date(),
    };
  }

  async payInvoice(bolt11: string) {
    const payment = await this.client.sendPaymentSync({
      paymentRequest: bolt11,
    });
    
    return {
      id: payment.paymentHash.toString('hex'),
      type: 'send' as const,
      status: payment.paymentError ? 'failed' : 'completed',
      amountSats: parseInt(payment.paymentRoute?.totalAmt || '0'),
      feeSats: parseInt(payment.paymentRoute?.totalFees || '0'),
      paymentHash: payment.paymentHash.toString('hex'),
      timestamp: new Date(),
    };
  }

  async getCurrentLSP(): Promise<LSPInfo> {
    const info = await this.client.getInfo();
    const channels = await this.client.listChannels();
    
    return {
      id: info.identityPubkey,
      name: info.alias || 'My Start9 LND',
      host: this.config.restUrl.replace('https://', '').replace('/v1', ''),
      pubkey: info.identityPubkey,
      baseFeeSats: 1000, // Configure your fees
      feeRate: 0.001, // 0.1%
      minChannelSize: 10000,
      maxChannelSize: 16777215, // Max channel size
      isActive: true,
      isDefault: true,
    };
  }
}

export { LNDService };
```

**Option B: Use LND Connect URL Parser**:

```typescript
// src/utils/lndConnect.ts
export function parseLndConnectUrl(url: string): LNDConfig {
  // lndconnect://host:port?macaroon=...&cert=...
  const match = url.match(/lndconnect:\/\/([^?]+)\?(.+)/);
  if (!match) throw new Error('Invalid LND Connect URL');
  
  const host = match[1];
  const params = new URLSearchParams(match[2]);
  
  return {
    restUrl: `https://${host}`,
    macaroon: params.get('macaroon') || '',
    cert: params.get('cert') || undefined,
  };
}
```

#### Step 4: Configure Starr Wallet for Start9 LND

1. **Add LND Configuration**:
   ```typescript
   // src/config/lnd.ts
   export const LND_CONFIG = {
     enabled: process.env.EXPO_PUBLIC_LND_ENABLED === 'true',
     lndConnectUrl: process.env.EXPO_PUBLIC_LND_CONNECT_URL || '',
     // Or individual credentials:
     restUrl: process.env.EXPO_PUBLIC_LND_REST_URL || '',
     macaroon: process.env.EXPO_PUBLIC_LND_MACAROON || '',
     cert: process.env.EXPO_PUBLIC_LND_CERT || '',
   };
   ```

2. **Update LSPManager**:
   ```typescript
   // In src/services/lsp/LSPManager.ts
   import { LNDService } from '../lnd/LNDService';
   
   async getAvailableLSPs(): Promise<LSPInfo[]> {
     const lsps: LSPInfo[] = [];
     
     // Add Start9 LND if configured
     if (LND_CONFIG.enabled && LND_CONFIG.lndConnectUrl) {
       const lndService = new LNDService(parseLndConnectUrl(LND_CONFIG.lndConnectUrl));
       const lspInfo = await lndService.getCurrentLSP();
       lsps.push(lspInfo);
     }
     
     // Add Breez LSPs as fallback
     const breezLSPs = await BreezService.getAvailableLSPs();
     lsps.push(...breezLSPs);
     
     return lsps;
   }
   ```

#### Step 5: Access Your Embassy Remotely

For mobile wallet access, you'll need to expose your Embassy:

1. **Tor (Recommended for Privacy)**:
   - StartOS has built-in Tor support
   - Your Embassy gets a `.onion` address
   - Use this address in your wallet config

2. **VPN**:
   - Set up WireGuard or Tailscale on your Embassy
   - Connect your phone to the VPN
   - Use local IP address

3. **Reverse Proxy** (Less Secure):
   - Use a domain with SSL certificate
   - Set up reverse proxy (nginx/Caddy)
   - Expose through firewall (not recommended)

#### Step 6: Implement LSP Functionality

To act as an LSP (opening channels for others), you'll need to:

1. **Build LSP API Service** on your Embassy:
   ```javascript
   // Install as a StartOS service or run separately
   const express = require('express');
   const { LndRestClient } = require('@lightninglabs/lnrpc');
   
   const app = express();
   const lnd = new LndRestClient({ /* your config */ });
   
   // Open channel for user
   app.post('/lsp/open-channel', async (req, res) => {
     const { pubkey, amount } = req.body;
     
     const channel = await lnd.openChannelSync({
       nodePubkey: Buffer.from(pubkey, 'hex'),
       localFundingAmount: amount,
       pushSat: Math.floor(amount * 0.5), // Provide inbound liquidity
     });
     
     res.json({ channelPoint: channel.fundingTxid });
   });
   
   app.listen(3000);
   ```

2. **Install as StartOS Service**:
   - Package your LSP API as a StartOS service
   - Or run it as a separate service on your Embassy

#### Resources for Start9

- **Start9 Documentation**: https://docs.start9.com
- **LND on Start9 Guide**: https://docs.start9.com/service-guides/lightning/lnd
- **Start9 Community**: https://community.start9.com
- **Marketplace**: Available in StartOS web interface

### Option 2: Use Umbrel (Alternative Easy Option)

**Umbrel** is another popular self-hosted server platform that makes running LND extremely easy. It's similar to Start9 but with a different interface and ecosystem.

#### Advantages of Umbrel

- ✅ **One-Click Install**: LND installs from the App Store
- ✅ **Beautiful UI**: Modern, user-friendly dashboard
- ✅ **App Ecosystem**: Many Lightning apps available (ThunderHub, Ride the Lightning, etc.)
- ✅ **Automatic Updates**: Apps update automatically
- ✅ **Tor Support**: Built-in Tor for privacy
- ✅ **Open Source**: Fully open-source platform
- ✅ **Active Community**: Large community and support

#### Step 1: Set Up Umbrel

1. **Install Umbrel**:
   - Download Umbrel OS from https://umbrel.com
   - Install on Raspberry Pi 4, Intel NUC, or compatible hardware
   - Or use Umbrel Home (pre-built device)
   - Follow initial setup wizard

2. **Install Bitcoin Node**:
   - Open Umbrel dashboard (usually `http://umbrel.local`)
   - Go to **App Store**
   - Install **Bitcoin** app
   - Wait for blockchain sync (can take days/weeks)

3. **Install Lightning Node**:
   - In App Store, install **Lightning** app (runs LND)
   - Lightning will automatically connect to your Bitcoin node
   - Create wallet through the Lightning app interface

#### Step 2: Access LND Connection Details

1. **Get LND Credentials from Umbrel**:
   - Open **Lightning** app in Umbrel dashboard
   - Navigate to **Settings** or **Connect** tab
   - You'll find:
     - **REST API URL**: Usually `https://umbrel.local:8080` (or your Tor address)
     - **Macaroon**: Download or copy the admin macaroon
     - **TLS Certificate**: Download the TLS certificate

2. **Alternative: Use LND Connect**:
   - Some Umbrel apps (like ThunderHub) provide LND Connect URLs
   - Format: `lndconnect://umbrel.local:8080?macaroon=...&cert=...`

3. **Tor Address** (for remote access):
   - Umbrel provides a `.onion` address automatically
   - Find it in **Settings → Tor**
   - Use this for secure remote access

#### Step 3: Connect to Your LND Node from Starr Wallet

The connection process is identical to Start9. Use the same `LNDService` code:

```typescript
// Same LNDService implementation as Start9
// src/services/lnd/LNDService.ts
import { LndRestClient } from '@lightninglabs/lnrpc';

interface LNDConfig {
  restUrl: string; // e.g., https://umbrel.local:8080 or https://your-onion.onion:8080
  macaroon: string; // Base64 encoded or hex
  cert?: string; // TLS certificate
}

class LNDService {
  // ... same implementation as Start9 section
}
```

**Configuration for Umbrel**:

```typescript
// src/config/lnd.ts
export const LND_CONFIG = {
  enabled: process.env.EXPO_PUBLIC_LND_ENABLED === 'true',
  // Local network access
  restUrl: process.env.EXPO_PUBLIC_LND_REST_URL || 'https://umbrel.local:8080',
  // Or use Tor for remote access
  // restUrl: process.env.EXPO_PUBLIC_LND_TOR_URL || 'https://your-onion.onion:8080',
  macaroon: process.env.EXPO_PUBLIC_LND_MACAROON || '',
  cert: process.env.EXPO_PUBLIC_LND_CERT || '',
};
```

#### Step 4: Access Your Umbrel Remotely

1. **Tor (Recommended)**:
   - Umbrel has built-in Tor support
   - Your Umbrel gets a `.onion` address automatically
   - Find it in **Settings → Tor**
   - Use this address in your wallet config for secure remote access

2. **Tailscale/VPN**:
   - Install Tailscale app on Umbrel
   - Connect your phone to the same Tailscale network
   - Use Tailscale IP address

3. **Port Forwarding** (Less Secure):
   - Forward port 8080 (LND REST) through your router
   - Use your public IP or domain
   - **Warning**: Only do this with proper firewall rules and authentication

#### Step 5: Use Umbrel Apps for Management

Umbrel has excellent apps for managing your LND node:

1. **ThunderHub**:
   - Visual channel management
   - Payment history
   - Node information
   - Install from Umbrel App Store

2. **Ride the Lightning (RTL)**:
   - Alternative web UI for LND
   - Channel management
   - Payment routing

3. **Lightning Terminal**:
   - Advanced channel management
   - Pool integration
   - Loop swaps

#### Step 6: Implement LSP Functionality

To act as an LSP, you can:

1. **Use Umbrel's API** (if available):
   - Some Umbrel apps expose APIs
   - Check app documentation

2. **Install Custom App**:
   - Create a custom Umbrel app for your LSP API
   - Package it following Umbrel app guidelines
   - Or run a separate service on your Umbrel device

3. **Direct LND Access**:
   - Use LND's gRPC/REST API directly
   - Build your LSP service as a separate app
   - Connect to LND through the same credentials

**Example LSP API Service** (can run on Umbrel):

```javascript
// lsp-service.js - Can be packaged as Umbrel app
const express = require('express');
const { LndRestClient } = require('@lightninglabs/lnrpc');
const fs = require('fs');

const app = express();
app.use(express.json());

// Load LND credentials (from Umbrel's LND data directory)
const macaroon = fs.readFileSync('/home/umbrel/umbrel/lnd/data/chain/bitcoin/mainnet/admin.macaroon');
const cert = fs.readFileSync('/home/umbrel/umbrel/lnd/tls.cert');

const lnd = new LndRestClient({
  server: 'https://localhost:8080',
  macaroon: macaroon,
  cert: cert,
});

// LSP endpoint: Open channel for user
app.post('/lsp/open-channel', async (req, res) => {
  const { pubkey, amount } = req.body;
  
  try {
    const channel = await lnd.openChannelSync({
      nodePubkey: Buffer.from(pubkey, 'hex'),
      localFundingAmount: amount,
      pushSat: Math.floor(amount * 0.5), // Provide inbound liquidity
    });
    
    res.json({ channelPoint: channel.fundingTxid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

#### Comparison: Umbrel vs Start9

| Feature | Umbrel | Start9 Embassy |
|---------|--------|----------------|
| **Ease of Use** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **App Ecosystem** | Large | Growing |
| **Open Source** | ✅ Fully open | ✅ Fully open |
| **Hardware** | Raspberry Pi, NUC, etc. | Embassy device or compatible |
| **Community** | Very large | Active |
| **UI/UX** | Modern, polished | Clean, functional |
| **Tor Support** | ✅ Built-in | ✅ Built-in |
| **Backup** | Manual/App-based | Built-in system |

Both are excellent choices! Choose based on:
- **Umbrel**: If you want a larger app ecosystem and community
- **Start9**: If you prefer a more structured service model

#### Resources for Umbrel

- **Umbrel Website**: https://umbrel.com
- **Umbrel Documentation**: https://docs.umbrel.com
- **Umbrel Community**: https://community.getumbrel.com
- **App Store**: Available in Umbrel dashboard
- **GitHub**: https://github.com/getumbrel/umbrel

### Option 3: Run Your Own Lightning Node with LSP Services (Manual Setup)

This is the most flexible approach. You'll run your own Lightning node (LND or CLN) and implement LSP functionality.

#### Prerequisites

- **Bitcoin Full Node**: Bitcoin Core (`bitcoind`) synced to mainnet
- **Lightning Node**: LND or Core Lightning (CLN)
- **Server**: VPS or dedicated server with:
  - 4+ CPU cores
  - 8GB+ RAM
  - 500GB+ SSD storage
  - Stable internet connection
  - High uptime (99%+)

#### Step 1: Set Up Bitcoin Full Node

1. **Install Bitcoin Core**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install bitcoin
   
   # Or compile from source
   git clone https://github.com/bitcoin/bitcoin.git
   cd bitcoin
   ./autogen.sh
   ./configure
   make
   sudo make install
   ```

2. **Configure `bitcoin.conf`**:
   ```conf
   # Network
   mainnet=1
   testnet=0
   
   # RPC Configuration
   rpcuser=your_secure_username
   rpcpassword=your_secure_password
   rpcallowip=127.0.0.1
   rpcbind=127.0.0.1
   rpcport=8332
   
   # ZMQ for Lightning
   zmqpubrawblock=tcp://127.0.0.1:28332
   zmqpubrawtx=tcp://127.0.0.1:28333
   
   # Performance
   txindex=1
   prune=0
   ```

3. **Start Bitcoin Core**:
   ```bash
   bitcoind -daemon
   ```

4. **Wait for sync** (this can take days/weeks):
   ```bash
   bitcoin-cli getblockcount
   ```

#### Step 2: Install Lightning Node (LND)

1. **Install LND**:
   ```bash
   # Download latest release
   wget https://github.com/lightningnetwork/lnd/releases/download/v0.17.0-beta/lnd-linux-amd64-v0.17.0-beta.tar.gz
   tar -xzf lnd-linux-amd64-v0.17.0-beta.tar.gz
   sudo install -m 0755 -o root -g root -t /usr/local/bin lnd-linux-amd64-v0.17.0-beta/*
   ```

2. **Configure `lnd.conf`**:
   ```conf
   [Application Options]
   debuglevel=info
   maxpendingchannels=10
   alias=YourLSPName
   color=#000000
   
   [Bitcoin]
   bitcoin.active=1
   bitcoin.mainnet=1
   bitcoin.node=bitcoind
   
   [Bitcoind]
   bitcoind.rpcuser=your_secure_username
   bitcoind.rpcpass=your_secure_password
   bitcoind.zmqpubrawblock=tcp://127.0.0.1:28332
   bitcoind.zmqpubrawtx=tcp://127.0.0.1:28333
   
   [routing]
   routing.assumechanvalid=1
   
   [protocol]
   protocol.wumbo-channels=1
   protocol.option-scid-alias=1
   ```

3. **Initialize LND**:
   ```bash
   lnd --lnddir=~/.lnd
   # This will prompt for a wallet password
   ```

4. **Create wallet**:
   ```bash
   lncli create
   ```

5. **Unlock wallet**:
   ```bash
   lncli unlock
   ```

#### Step 3: Fund Your Node

1. **Get a Bitcoin address**:
   ```bash
   lncli newaddress p2wkh
   ```

2. **Send Bitcoin to this address** (at least 0.1 BTC recommended for LSP operations)

3. **Open channels** with well-connected nodes:
   ```bash
   # Find well-connected nodes
   lncli listchannels | head -20
   
   # Open channel (example)
   lncli openchannel --node_key=<pubkey> --local_amt=50000000
   ```

#### Step 4: Implement LSP Functionality

You'll need to build an API service that provides LSP functionality. Here's a basic structure:

**LSP API Service** (Node.js example):

```javascript
// lsp-server.js
const express = require('express');
const { grpc } = require('@improbable-eng/grpc-web');
const { lnrpc } = require('lnrpc');

const app = express();
app.use(express.json());

// LSP endpoint: Open channel for user
app.post('/lsp/open-channel', async (req, res) => {
  const { pubkey, amount } = req.body;
  
  try {
    // Open channel to user's node
    const channel = await lnClient.openChannel({
      nodePubkey: pubkey,
      localFundingAmount: amount,
      pushSat: amount * 0.5, // Provide inbound liquidity
    });
    
    res.json({ channelPoint: channel.fundingTxid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LSP endpoint: Get LSP info
app.get('/lsp/info', async (req, res) => {
  const nodeInfo = await lnClient.getInfo();
  const channels = await lnClient.listChannels();
  
  res.json({
    id: nodeInfo.identityPubkey,
    name: nodeInfo.alias,
    pubkey: nodeInfo.identityPubkey,
    host: 'your-lsp-domain.com',
    baseFeeSats: 1000, // Your base fee
    feeRate: 0.001, // 0.1% fee rate
    minChannelSize: 10000,
    maxChannelSize: 10000000,
    capacity: channels.reduce((sum, ch) => sum + ch.capacity, 0),
  });
});

app.listen(3000, () => {
  console.log('LSP server running on port 3000');
});
```

#### Step 5: Modify Starr Wallet to Connect to Your LSP

Since Breez SDK doesn't support custom LSPs, you'll need to:

1. **Option A**: Switch to LDK (Lightning Development Kit) or LND mobile SDK
2. **Option B**: Build a custom Lightning service that connects to your LND node via gRPC

**Example: Custom LND Service** (to replace BreezService):

```typescript
// src/services/lnd/LNDService.ts
import { grpc } from '@improbable-eng/grpc-web';
import { lnrpc } from 'lnrpc';

class LNDService {
  private client: any;
  private lspEndpoint: string;

  constructor(lspEndpoint: string) {
    this.lspEndpoint = lspEndpoint;
    // Initialize gRPC client to your LND node
  }

  async initialize(mnemonic: string) {
    // Connect to your LND node
    // Create/restore wallet from mnemonic
  }

  async getCurrentLSP(): Promise<LSPInfo> {
    // Fetch LSP info from your API
    const response = await fetch(`${this.lspEndpoint}/lsp/info`);
    return response.json();
  }

  async openChannel(amountSats: number) {
    // Request channel opening from your LSP
    const response = await fetch(`${this.lspEndpoint}/lsp/open-channel`, {
      method: 'POST',
      body: JSON.stringify({
        pubkey: await this.getPubkey(),
        amount: amountSats,
      }),
    });
    return response.json();
  }
}
```

### Option 2: Use Core Lightning (CLN) with Plugins

Core Lightning (CLN) has a plugin system that makes LSP implementation easier:

1. **Install CLN**:
   ```bash
   git clone https://github.com/ElementsProject/lightning.git
   cd lightning
   ./configure
   make
   sudo make install
   ```

2. **Configure CLN**:
   ```conf
   network=bitcoin
   bitcoin-rpcuser=your_username
   bitcoin-rpcpassword=your_password
   plugin=/path/to/lsp-plugin
   ```

3. **Use CLN plugins**:
   - `cln-plugin-lsp`: Provides LSP functionality
   - `cln-plugin-channel-funder`: Auto-opens channels

### Option 3: Use Existing LSP Solutions

Instead of building from scratch, consider:

1. **DUNDER LSP**: Open-source LSP implementation
   - GitHub: https://github.com/dunder-lsp/dunder-lsp
   - Automates inbound liquidity provision

2. **Lightning Pool**: Liquidity marketplace
   - Allows you to lease liquidity
   - Can be used to provide LSP services

3. **Lightning Terminal**: Web UI for LND
   - Includes channel management tools
   - Can help with LSP operations

## Integration with Starr Wallet

### Modifying Your Codebase

To use your own LSP instead of Breez:

1. **Create a new service** (`src/services/custom-lsp/`):
   ```typescript
   // CustomLSPService.ts
   export class CustomLSPService {
     private lspEndpoint: string;
     
     constructor(endpoint: string) {
       this.lspEndpoint = endpoint;
     }
     
     async getLSPInfo(): Promise<LSPInfo> {
       // Fetch from your LSP API
     }
     
     async openChannel(amount: number): Promise<void> {
       // Request channel from your LSP
     }
   }
   ```

2. **Update LSPManager** to support custom LSPs:
   ```typescript
   // In LSPManager.ts
   async getAvailableLSPs(): Promise<LSPInfo[]> {
     // Add your custom LSP
     const customLSP = await customLSPService.getLSPInfo();
     const breezLSPs = await BreezService.getAvailableLSPs();
     
     return [customLSP, ...breezLSPs];
   }
   ```

3. **Add configuration**:
   ```typescript
   // src/config/lsp.ts
   export const CUSTOM_LSP_CONFIG = {
     enabled: process.env.EXPO_PUBLIC_CUSTOM_LSP_ENABLED === 'true',
     endpoint: process.env.EXPO_PUBLIC_CUSTOM_LSP_ENDPOINT || '',
     apiKey: process.env.EXPO_PUBLIC_CUSTOM_LSP_API_KEY || '',
   };
   ```

## Security Considerations

1. **TLS/SSL**: Always use HTTPS for LSP API endpoints
2. **Authentication**: Implement API keys or OAuth for LSP access
3. **Rate Limiting**: Prevent abuse of your LSP service
4. **Monitoring**: Set up alerts for channel balance, node status
5. **Backups**: Regular backups of LND data directory
6. **Firewall**: Only expose necessary ports

## Cost Considerations

Running your own LSP requires:
- **Server costs**: $50-200/month for VPS
- **Bitcoin capital**: 0.1-1+ BTC locked in channels
- **Maintenance time**: Regular monitoring and updates
- **Bandwidth**: Lightning routing uses significant bandwidth

## Testing

1. **Start with testnet**:
   ```bash
   # Use testnet for initial testing
   bitcoin-cli -testnet getblockcount
   lnd --network=testnet
   ```

2. **Test channel operations**:
   ```bash
   # Open test channel
   lncli --network=testnet openchannel <testnet-pubkey> 1000000
   ```

3. **Test LSP API**:
   ```bash
   curl -X POST http://localhost:3000/lsp/open-channel \
     -H "Content-Type: application/json" \
     -d '{"pubkey":"...","amount":1000000}'
   ```

## Resources

- **LND Documentation**: https://docs.lightning.engineering/
- **Core Lightning Docs**: https://lightning.readthedocs.io/
- **Lightning Network Spec**: https://github.com/lightning/bolts
- **DUNDER LSP**: https://github.com/dunder-lsp/dunder-lsp
- **Lightning Pool**: https://lightning.engineering/pool/

## Next Steps

### If Using Start9 Embassy or Umbrel (Easiest Path):

1. Set up your device (Start9 Embassy or Umbrel on compatible hardware)
2. Install Bitcoin Core and LND from the App Store/Marketplace
3. Get LND connection credentials (REST URL, macaroon, cert)
4. Configure Starr wallet with LND connection details
5. Test on testnet first (if available)
6. Build LSP API service (optional, for providing LSP to others)

**Choosing between Start9 and Umbrel:**
- **Start9**: More structured service model, built-in backup system
- **Umbrel**: Larger app ecosystem, very active community
- Both are excellent choices and work the same way for LND access

### If Setting Up Manually:

1. Set up Bitcoin full node on testnet
2. Install and configure LND
3. Build basic LSP API
4. Test with Starr wallet on testnet
5. Deploy to mainnet when ready

---

**Note**: Running your own LSP is a significant undertaking. Consider starting with testnet and gradually moving to mainnet as you gain experience.


