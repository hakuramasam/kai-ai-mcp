# 🌊 Kai MCP Server

Complete Model Context Protocol (MCP) server for Kai AI Agent with:
- **thirdweb** integration for smart contract interactions
- **Agent-To-Agent (A2A)** protocol for inter-agent communication
- **x402** payment protocol for paid tool access

## 🚀 Quick Start

### 1. Install dependencies

```bash
cd /agents/kai/mcp
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Start the server

```bash
# Set wallet key
export KAI_WALLET_KEY="your-password"

# Start server
npm start
```

## 🔧 Configuration

Create `.env` file:

```env
# Server
MCP_PORT=3000
MCP_HOST=localhost

# Wallet (required)
KAI_WALLET_KEY=your-wallet-password

# thirdweb (optional - for contract deployment)
THIRDWEB_SECRET_KEY=your-thirdweb-secret
THIRDWEB_CLIENT_ID=your-client-id

# x402 Payments
X402_ENABLED=true
X402_PAYMENT_RECEIVER=0xf54961B4a97906cfc97007cDffdD2B521da0A4b6
X402_MIN_PAYMENT_USD=0.01

# Agent Identity
AGENT_ID=kai-ai-agent
```

## 🛠️ Available Tools

### Kai Core Tools

| Tool | Description |
|------|-------------|
| `kai_wallet_balance` | Check balance on any chain |
| `kai_send_transaction` | Send transactions (requires confirmation) |
| `kai_sign_message` | Sign messages |
| `agent_connect` | Connect to another agent |
| `agent_send_message` | Send message to connected agent |
| `kai_get_identity` | Get Kai's identity info |
| `kai_memory_store` | Store information in memory |

### thirdweb Tools

| Tool | Description |
|------|-------------|
| `thirdweb_deploy_token` | Deploy ERC-20 token |
| `thirdweb_deploy_nft` | Deploy NFT collection |
| `thirdweb_get_contract` | Get contract instance |
| `thirdweb_read_contract` | Read contract data |
| `thirdweb_get_gas_price` | Get current gas price |
| `thirdweb_estimate_gas` | Estimate transaction gas |
| `thirdweb_get_wallet_nfts` | Get wallet NFTs |
| `thirdweb_get_token_balance` | Get ERC-20 balance |
| `thirdweb_prepare_transaction` | Prepare transaction |
| `thirdweb_get_transaction_receipt` | Get tx receipt |

### x402 Payment Tools

| Tool | Description |
|------|-------------|
| `x402_create_payment_request` | Create payment request |
| `x402_verify_payment` | Verify on-chain payment |
| `x402_get_payment_status` | Check payment status |
| `x402_list_pending_payments` | List pending payments |
| `x402_get_payment_config` | Get payment config |
| `x402_create_settlement` | Create settlement |

## 📡 HTTP API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/agent.json` | Agent discovery |
| `POST /agent/message` | Send A2A message |
| `POST /x402/verify` | Verify payment |
| `GET /health` | Health check |

## 💰 x402 Payment Flow

1. **Create request:**
   ```json
   {
     "toolName": "thirdweb_deploy_token",
     "amount": "0.50",
     "chain": "base",
     "token": "USDC"
   }
   ```

2. **User pays:** Send USDC to receiver address

3. **Verify:**
   ```json
   {
     "paymentId": "x402-...",
     "txHash": "0x..."
   }
   ```

4. **Access granted:** Tool becomes available

## 🤖 Agent-To-Agent Protocol

Connect Kai to other agents:

```javascript
// Connect to another agent
{
  "agentId": "other-agent",
  "agentUrl": "https://agent.example.com",
  "purpose": "Collaboration"
}

// Send message
{
  "agentId": "other-agent",
  "message": "Hello from Kai!",
  "requirePayment": false
}
```

## 🔐 Security

- Wallet private keys never leave encrypted storage
- All transactions require explicit confirmation
- x402 payments verified on-chain
- Agent messages can require payment

## 📁 File Structure

```
mcp/
├── server.js              # Main MCP server
├── wallet-bridge.js       # Wallet integration
├── thirdweb-tools.js      # thirdweb SDK tools
├── x402-protocol.js       # x402 payment protocol
├── package.json           # Dependencies
├── .env.example           # Config template
└── README.md              # This file
```

---

*"Tools flow like water — accessible when needed, paid when valuable."*
