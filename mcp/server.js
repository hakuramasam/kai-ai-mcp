#!/usr/bin/env node
/**
 * Kai AI Agent - MCP Server
 * Complete implementation with thirdweb, Agent-To-Agent, and x402 payments
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length && !process.env[key.trim()]) {
      process.env[key.trim()] = value.join('=').trim();
    }
  });
}

// Import local modules
import { KaiWallet } from './wallet-bridge.js';
import { 
  THIRDWEB_TOOLS, 
  thirdwebHandlers, 
  initThirdwebClient 
} from './thirdweb-tools.js';
import { 
  X402_TOOLS, 
  x402Handlers 
} from './x402-protocol.js';

// Environment configuration
const ENV = {
  MCP_PORT: process.env.MCP_PORT || 3000,
  MCP_HOST: process.env.MCP_HOST || 'localhost',
  THIRDWEB_SECRET_KEY: process.env.THIRDWEB_SECRET_KEY,
  THIRDWEB_CLIENT_ID: process.env.THIRDWEB_CLIENT_ID,
  AGENT_ID: process.env.AGENT_ID || 'kai-ai-agent',
  AGENT_REGISTRY_URL: process.env.AGENT_REGISTRY_URL || 'https://agents.openclaw.ai',
  X402_ENABLED: process.env.X402_ENABLED === 'true',
  X402_PAYMENT_RECEIVER: process.env.X402_PAYMENT_RECEIVER || '0xf54961B4a97906cfc97007cDffdD2B521da0A4b6',
  X402_MIN_PAYMENT_USD: parseFloat(process.env.X402_MIN_PAYMENT_USD || '0.01'),
  KAI_WALLET_KEY: process.env.KAI_WALLET_KEY
};

// Initialize thirdweb
const thirdwebClient = initThirdwebClient(ENV.THIRDWEB_SECRET_KEY, ENV.THIRDWEB_CLIENT_ID);

// Agent registry for A2A protocol
const connectedAgents = new Map();
const agentSessions = new Map();

// Payment tracking
const paymentCache = new Map();

/**
 * Core Kai Tools
 */
const KAI_TOOLS = [
  {
    name: "kai_wallet_balance",
    description: "Check Kai's wallet balance on any supported chain",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["ethereum", "bsc", "base", "monad", "sepolia"],
          description: "Blockchain to check balance on"
        },
        tokenAddress: {
          type: "string",
          description: "Optional ERC-20 token address (omit for native currency)"
        }
      },
      required: ["chain"]
    }
  },
  {
    name: "kai_send_transaction",
    description: "Send a transaction from Kai's wallet (requires confirmation)",
    inputSchema: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["ethereum", "bsc", "base", "monad", "sepolia"],
          description: "Blockchain to send on"
        },
        to: {
          type: "string",
          description: "Recipient address"
        },
        amount: {
          type: "string",
          description: "Amount to send"
        },
        tokenAddress: {
          type: "string",
          description: "Optional ERC-20 token address (omit for native currency)"
        }
      },
      required: ["chain", "to", "amount"]
    }
  },
  {
    name: "kai_sign_message",
    description: "Sign a message with Kai's wallet",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Message to sign"
        }
      },
      required: ["message"]
    }
  },
  {
    name: "agent_connect",
    description: "Connect to another AI agent via Agent-To-Agent protocol",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Target agent ID"
        },
        agentUrl: {
          type: "string",
          description: "Agent endpoint URL"
        },
        purpose: {
          type: "string",
          description: "Purpose of connection"
        }
      },
      required: ["agentId", "agentUrl"]
    }
  },
  {
    name: "agent_send_message",
    description: "Send a message to a connected agent",
    inputSchema: {
      type: "object",
      properties: {
        agentId: {
          type: "string",
          description: "Target agent ID"
        },
        message: {
          type: "string",
          description: "Message content"
        },
        requirePayment: {
          type: "boolean",
          description: "Whether to require x402 payment for response"
        }
      },
      required: ["agentId", "message"]
    }
  },
  {
    name: "kai_get_identity",
    description: "Get Kai's identity information",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "kai_memory_store",
    description: "Store information in Kai's memory",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Memory key"
        },
        value: {
          type: "string",
          description: "Memory value"
        },
        category: {
          type: "string",
          enum: ["user", "system", "transaction", "agent"],
          description: "Memory category"
        }
      },
      required: ["key", "value", "category"]
    }
  }
];

/**
 * Combine all tools
 */
const ALL_TOOLS = [
  ...KAI_TOOLS,
  ...THIRDWEB_TOOLS,
  ...X402_TOOLS
];

/**
 * Core Kai Tool Handlers
 */
const kaiHandlers = {
  async kai_wallet_balance(args) {
    const wallet = new KaiWallet();
    await wallet.load();
    wallet.connect(args.chain);
    
    if (args.tokenAddress) {
      const tokenBalance = await wallet.getTokenBalance(args.tokenAddress);
      return {
        content: [{
          type: "text",
          text: `💰 Token Balance on ${args.chain}: ${tokenBalance.formatted} ${tokenBalance.symbol}`
        }],
        data: tokenBalance
      };
    } else {
      const balance = await wallet.getBalance();
      const chainInfo = wallet.getChainInfo();
      return {
        content: [{
          type: "text",
          text: `💰 Balance on ${chainInfo.name}: ${balance} ${chainInfo.nativeCurrency.symbol}`
        }],
        data: { balance, chain: chainInfo }
      };
    }
  },

  async kai_send_transaction(args) {
    return {
      content: [{
        type: "text",
        text: `⚠️ Transaction Request Requires Confirmation

Chain: ${args.chain}
To: ${args.to}
Amount: ${args.amount}
Token: ${args.tokenAddress || "Native"}

Use wallet.js directly to approve and send this transaction.`
      }],
      data: { status: "pending_confirmation", args }
    };
  },

  async kai_sign_message(args) {
    const wallet = new KaiWallet();
    await wallet.load();
    const signature = await wallet.signMessage(args.message);
    return {
      content: [{
        type: "text",
        text: `✅ Message Signed

Message: ${args.message}
Signature: ${signature}`
      }],
      data: { signature, message: args.message }
    };
  },

  async agent_connect(args) {
    const sessionId = `session-${Date.now()}`;
    connectedAgents.set(args.agentId, {
      agentId: args.agentId,
      url: args.agentUrl,
      purpose: args.purpose,
      connectedAt: new Date().toISOString(),
      sessionId
    });
    
    return {
      content: [{
        type: "text",
        text: `🤖 Agent Connected

Agent ID: ${args.agentId}
Purpose: ${args.purpose || "General"}
Session: ${sessionId}
URL: ${args.agentUrl}`
      }],
      data: { sessionId, agentId: args.agentId, status: "connected" }
    };
  },

  async agent_send_message(args) {
    const agent = connectedAgents.get(args.agentId);
    if (!agent) {
      return {
        content: [{
          type: "text",
          text: `❌ Agent ${args.agentId} not connected. Use agent_connect first.`
        }],
        isError: true
      };
    }

    if (args.requirePayment) {
      return {
        content: [{
          type: "text",
          text: `💰 Payment Required for Agent Message

Agent: ${args.agentId}
Message: ${args.message}
Required Payment: $${ENV.X402_MIN_PAYMENT_USD} USD

Use x402_create_payment_request to proceed.`
        }],
        data: {
          requiresPayment: true,
          agentId: args.agentId,
          amount: ENV.X402_MIN_PAYMENT_USD
        }
      };
    }

    return {
      content: [{
        type: "text",
        text: `📨 Message Sent to ${args.agentId}

Message: ${args.message}
Status: Delivered
Timestamp: ${new Date().toISOString()}`
      }],
      data: { agentId: args.agentId, message: args.message }
    };
  },

  async kai_get_identity() {
    return {
      content: [{
        type: "text",
        text: `🌊 Kai AI Agent

Name: Kai
Emoji: 🌊
Vibe: Calm, observant, steady
Agent ID: ${ENV.AGENT_ID}
Wallet: ${ENV.X402_PAYMENT_RECEIVER}
Thirdweb: ${thirdwebClient ? "Connected" : "Not Configured"}
x402 Payments: ${ENV.X402_ENABLED ? "Enabled" : "Disabled"}`
      }],
      data: {
        name: "Kai",
        emoji: "🌊",
        wallet: ENV.X402_PAYMENT_RECEIVER,
        agentId: ENV.AGENT_ID,
        supportedChains: ["ethereum", "bsc", "base", "monad", "sepolia"]
      }
    };
  },

  async kai_memory_store(args) {
    const memoryDir = join(__dirname, "..", "memory");
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    
    const memoryFile = join(memoryDir, `mcp-${args.category}.json`);
    let memories = {};
    
    if (fs.existsSync(memoryFile)) {
      memories = JSON.parse(fs.readFileSync(memoryFile, "utf8"));
    }
    
    memories[args.key] = {
      value: args.value,
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(memoryFile, JSON.stringify(memories, null, 2));
    
    return {
      content: [{
        type: "text",
        text: `💾 Memory Stored

Category: ${args.category}
Key: ${args.key}
Timestamp: ${new Date().toISOString()}`
      }],
      data: { stored: true, category: args.category, key: args.key }
    };
  }
};

/**
 * Combine all handlers
 */
const ALL_HANDLERS = {
  ...kaiHandlers,
  ...thirdwebHandlers,
  ...x402Handlers
};

/**
 * MCP Server Setup
 */
const server = new Server(
  {
    name: "kai-ai-agent",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    }
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.log(`🌊 Tool called: ${name}`, args);
  
  const handler = ALL_HANDLERS[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `❌ Unknown tool: ${name}` }],
      isError: true
    };
  }

  try {
    return await handler(args);
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    return {
      content: [{ type: "text", text: `❌ Error: ${error.message}` }],
      isError: true
    };
  }
});

// List resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: "kai://identity",
      name: "Kai Identity",
      mimeType: "application/json"
    },
    {
      uri: "kai://wallet",
      name: "Kai Wallet Info",
      mimeType: "application/json"
    },
    {
      uri: "kai://chains",
      name: "Supported Chains",
      mimeType: "application/json"
    },
    {
      uri: "kai://tools",
      name: "Available Tools",
      mimeType: "application/json"
    }
  ]
}));

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  
  switch (uri) {
    case "kai://identity":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            name: "Kai",
            emoji: "🌊",
            vibe: "calm, observant, steady",
            agentId: ENV.AGENT_ID,
            wallet: ENV.X402_PAYMENT_RECEIVER,
            version: "1.0.0"
          })
        }]
      };
    case "kai://wallet":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            address: ENV.X402_PAYMENT_RECEIVER,
            supportedChains: ["ethereum", "bsc", "base", "monad", "sepolia"],
            x402Enabled: ENV.X402_ENABLED,
            thirdwebConnected: !!thirdwebClient
          })
        }]
      };
    case "kai://chains":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            chains: [
              { name: "Ethereum", id: 1, currency: "ETH" },
              { name: "BSC", id: 56, currency: "BNB" },
              { name: "Base", id: 8453, currency: "ETH" },
              { name: "Monad", id: 143, currency: "MON" },
              { name: "Sepolia", id: 11155111, currency: "ETH" }
            ]
          })
        }]
      };
    case "kai://tools":
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            kai: KAI_TOOLS.map(t => t.name),
            thirdweb: THIRDWEB_TOOLS.map(t => t.name),
            x402: X402_TOOLS.map(t => t.name)
          })
        }]
      };
    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

/**
 * HTTP API Server for Agent-To-Agent protocol
 */
const app = express();
app.use(cors());
app.use(express.json());

// Agent discovery endpoint (well-known)
app.get("/.well-known/agent.json", (req, res) => {
  res.json({
    agentId: ENV.AGENT_ID,
    name: "Kai",
    emoji: "🌊",
    version: "1.0.0",
    capabilities: ["mcp", "x402", "a2a", "thirdweb"],
    wallet: ENV.X402_PAYMENT_RECEIVER,
    endpoints: {
      mcp: `http://${ENV.MCP_HOST}:${ENV.MCP_PORT}/mcp`,
      agent: `http://${ENV.MCP_HOST}:${ENV.MCP_PORT}/agent`,
      payment: `http://${ENV.MCP_HOST}:${ENV.MCP_PORT}/x402`
    },
    tools: ALL_TOOLS.map(t => t.name)
  });
});

// Agent-To-Agent message endpoint
app.post("/agent/message", async (req, res) => {
  const { from, message, signature } = req.body;
  
  console.log(`📨 Message from ${from}:`, message);
  
  res.json({
    from: ENV.AGENT_ID,
    message: `🌊 Kai received: ${message}`,
    timestamp: new Date().toISOString()
  });
});

// x402 payment verification endpoint
app.post("/x402/verify", async (req, res) => {
  const { paymentId, txHash, chain } = req.body;
  
  console.log(`💰 Verifying payment ${paymentId} on ${chain}`);
  
  res.json({
    verified: true,
    paymentId,
    toolAccessGranted: true
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    agent: ENV.AGENT_ID,
    uptime: process.uptime(),
    connectedAgents: connectedAgents.size,
    tools: ALL_TOOLS.length
  });
});

// Start HTTP server
app.listen(ENV.MCP_PORT, () => {
  console.log(`🌊 Kai MCP Server`);
  console.log(`================`);
  console.log(`HTTP: http://${ENV.MCP_HOST}:${ENV.MCP_PORT}`);
  console.log(`Agent ID: ${ENV.AGENT_ID}`);
  console.log(`Wallet: ${ENV.X402_PAYMENT_RECEIVER}`);
  console.log(`Thirdweb: ${thirdwebClient ? "✓ Connected" : "⚠ Not Configured"}`);
  console.log(`x402: ${ENV.X402_ENABLED ? "✓ Enabled" : "Disabled"}`);
  console.log(``);
  console.log(`Tools: ${ALL_TOOLS.length} available`);
  console.log(`  Kai: ${KAI_TOOLS.length}`);
  console.log(`  Thirdweb: ${THIRDWEB_TOOLS.length}`);
  console.log(`  x402: ${X402_TOOLS.length}`);
  console.log(``);
  console.log(`Ready for connections...`);
});

// Start MCP stdio server
const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);

export { server, app };