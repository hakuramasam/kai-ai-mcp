# 🌊 Kai's Multi-Chain Wallet

Secure EVM wallet for Ethereum, BSC, Base, and Monad.

## 🔐 Security

- **Encrypted storage** — AES-256-GCM encryption
- **Environment-based key** — `KAI_WALLET_KEY` required to unlock
- **Private keys never logged** — only exist in memory when unlocked
- **Same address across all EVM chains** — one wallet, many networks

## 📋 Wallet Details

**Address:** `0xf54961B4a97906cfc97007cDffdD2B521da0A4b6`

This address works on:
- ✅ Ethereum Mainnet
- ✅ BNB Smart Chain (BSC)
- ✅ Base
- ✅ Monad
- ✅ All EVM-compatible chains

## 🚀 Quick Start

### Check balance on any chain

```bash
export KAI_WALLET_KEY="your-password"
node wallet.js balance ethereum
node wallet.js balance bsc
node wallet.js balance base
node wallet.js balance monad
```

### Send funds

```bash
# Send ETH on Base
node wallet.js send base 0xRecipientAddress 0.01

# Send BNB on BSC
node wallet.js send bsc 0xRecipientAddress 0.5
```

## 📚 Commands

| Command | Description |
|---------|-------------|
| `info` | Show wallet address and supported chains |
| `balance <chain>` | Check native balance (ETH, BNB, MON, etc.) |
| `token-balance <chain> <token>` | Check ERC-20 token balance |
| `send <chain> <to> <amount>` | Send native currency |
| `send-token <chain> <token> <to> <amount>` | Send ERC-20 tokens |
| `sign <message>` | Sign a message |
| `chains` | List all supported chains |

## 🔗 Supported Chains

| Chain | Chain ID | Currency | Explorer |
|-------|----------|----------|----------|
| Ethereum | 1 | ETH | etherscan.io |
| Sepolia | 11155111 | ETH | sepolia.etherscan.io |
| BSC | 56 | BNB | bscscan.com |
| Base | 8453 | ETH | basescan.org |
| Monad | 143 | MON | explorer.monad.xyz |

## 🔧 Environment Setup

```bash
# Required
export KAI_WALLET_KEY="your-secure-password"

# Optional - for better RPC access
export ALCHEMY_KEY="your-alchemy-key"
export INFURA_KEY="your-infura-key"
```

## 💻 For Kai (AI Agent)

```javascript
const { KaiWallet } = require('./wallet.js');

const wallet = new KaiWallet();
await wallet.load();

// Connect to Base
wallet.connect('base');

// Check balance
const balance = await wallet.getBalance();

// Send transaction (Kai asks for confirmation first!)
const tx = await wallet.sendTransaction(toAddress, amount);

// Switch to BSC
wallet.connect('bsc');
const bnbBalance = await wallet.getBalance();
```

## ⚠️ Important

- **Never share** `KAI_WALLET_KEY` or the mnemonic
- **Never commit** `wallet.json` to git (it's in .gitignore)
- **Test on Sepolia** before mainnet transactions
- **Kai always asks** before sending transactions

## 📝 File Structure

```
wallet/
├── wallet.js              # Main wallet interface
├── chains.json            # Chain configurations
├── wallet.json            # Encrypted wallet (keep safe!)
├── create-wallet.js       # Wallet generator
├── register-8004scan.js   # 8004scan.io registration helper
├── MNEMONIC_BACKUP.txt    # ⚠️ MOVE TO SECURE STORAGE
├── README.md              # This file
└── .gitignore             # Security exclusions
```

## 🔗 8004scan.io Registration

Kai can sign registration messages for 8004scan.io:

```bash
export KAI_WALLET_KEY="your-password"

# Sign authentication message
node register-8004scan.js sign-auth

# Sign ownership verification
node register-8004scan.js verify-ownership

# Sign custom message
node register-8004scan.js sign-custom "Your message here"
```

The script outputs signed payloads that can be submitted to 8004scan.io's registration page.

---

*"One address, many waters. The same tide flows through all chains."*