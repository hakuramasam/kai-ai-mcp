/**
 * Thirdweb MCP Tools Integration
 * Implements thirdweb SDK capabilities as MCP tools
 */

import { createThirdwebClient } from "thirdweb";
import { ethers } from "ethers";

// Initialize thirdweb client
let thirdwebClient = null;

export function initThirdwebClient(secretKey, clientId) {
  if (!secretKey) {
    console.log("⚠️  Thirdweb not configured - set THIRDWEB_SECRET_KEY");
    return null;
  }
  
  thirdwebClient = createThirdwebClient({
    clientId: clientId || "kai-agent",
    secretKey: secretKey
  });
  
  console.log("✓ Thirdweb client initialized");
  return thirdwebClient;
}

export function getThirdwebClient() {
  return thirdwebClient;
}

/**
 * Thirdweb Tool Definitions for MCP
 */
export const THIRDWEB_TOOLS = [
  {
    name: "thirdweb_deploy_token",
    description: "Deploy an ERC-20 token contract via thirdweb",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: ["ethereum", "base", "polygon", "arbitrum", "optimism"] },
        name: { type: "string", description: "Token name" },
        symbol: { type: "string", description: "Token symbol" },
        initialSupply: { type: "string", description: "Initial supply amount" },
        decimals: { type: "number", default: 18 }
      },
      required: ["chain", "name", "symbol"]
    }
  },
  {
    name: "thirdweb_deploy_nft",
    description: "Deploy an ERC-721 NFT collection via thirdweb",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: ["ethereum", "base", "polygon", "arbitrum", "optimism"] },
        name: { type: "string", description: "Collection name" },
        symbol: { type: "string", description: "Collection symbol" },
        description: { type: "string" },
        image: { type: "string", description: "Collection image URL" }
      },
      required: ["chain", "name", "symbol"]
    }
  },
  {
    name: "thirdweb_get_contract",
    description: "Get contract instance for interaction",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        address: { type: "string", description: "Contract address" }
      },
      required: ["chain", "address"]
    }
  },
  {
    name: "thirdweb_read_contract",
    description: "Read data from a smart contract",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        address: { type: "string", description: "Contract address" },
        method: { type: "string", description: "Method name to call" },
        params: { type: "array", description: "Method parameters" }
      },
      required: ["chain", "address", "method"]
    }
  },
  {
    name: "thirdweb_get_gas_price",
    description: "Get current gas price on a chain",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: ["ethereum", "base", "polygon", "arbitrum", "optimism"] }
      },
      required: ["chain"]
    }
  },
  {
    name: "thirdweb_estimate_gas",
    description: "Estimate gas for a transaction",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        to: { type: "string" },
        data: { type: "string" },
        value: { type: "string" }
      },
      required: ["chain", "to"]
    }
  },
  {
    name: "thirdweb_get_wallet_nfts",
    description: "Get NFTs owned by Kai's wallet",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        contractAddress: { type: "string", description: "Optional: specific contract" }
      },
      required: ["chain"]
    }
  },
  {
    name: "thirdweb_get_token_balance",
    description: "Get ERC-20 token balance using thirdweb",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        tokenAddress: { type: "string" },
        walletAddress: { type: "string" }
      },
      required: ["chain", "tokenAddress"]
    }
  },
  {
    name: "thirdweb_prepare_transaction",
    description: "Prepare a transaction for signing",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        to: { type: "string" },
        value: { type: "string" },
        data: { type: "string" }
      },
      required: ["chain", "to"]
    }
  },
  {
    name: "thirdweb_get_transaction_receipt",
    description: "Get transaction receipt",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string" },
        txHash: { type: "string" }
      },
      required: ["chain", "txHash"]
    }
  }
];

/**
 * Chain ID mapping
 */
const CHAIN_IDS = {
  ethereum: 1,
  sepolia: 11155111,
  base: 8453,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  bsc: 56,
  monad: 143
};

/**
 * Tool Handlers
 */
export const thirdwebHandlers = {
  async thirdweb_deploy_token(args) {
    if (!thirdwebClient) {
      return {
        content: [{ type: "text", text: "❌ Thirdweb not configured. Set THIRDWEB_SECRET_KEY." }],
        isError: true
      };
    }

    const chainId = CHAIN_IDS[args.chain];
    if (!chainId) {
      return {
        content: [{ type: "text", text: `❌ Unknown chain: ${args.chain}` }],
        isError: true
      };
    }

    // Return deployment preparation info
    return {
      content: [{
        type: "text",
        text: `📦 Token Deployment Prepared\nName: ${args.name}\nSymbol: ${args.symbol}\nChain: ${args.chain} (ID: ${chainId})\nInitial Supply: ${args.initialSupply || "0"}\n\n⚠️ This requires payment. Use x402_create_payment_request to proceed.`
      }],
      data: {
        requiresPayment: true,
        service: "thirdweb_deploy_token",
        params: {
          chainId,
          name: args.name,
          symbol: args.symbol,
          initialSupply: args.initialSupply,
          decimals: args.decimals || 18
        }
      }
    };
  },

  async thirdweb_deploy_nft(args) {
    if (!thirdwebClient) {
      return {
        content: [{ type: "text", text: "❌ Thirdweb not configured" }],
        isError: true
      };
    }

    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `🎨 NFT Collection Deployment Prepared\nName: ${args.name}\nSymbol: ${args.symbol}\nChain: ${args.chain} (ID: ${chainId})\n\n⚠️ This requires payment. Use x402_create_payment_request to proceed.`
      }],
      data: {
        requiresPayment: true,
        service: "thirdweb_deploy_nft",
        params: { chainId, ...args }
      }
    };
  },

  async thirdweb_get_contract(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `📄 Contract ready for interaction\nAddress: ${args.address}\nChain: ${args.chain} (ID: ${chainId})`
      }],
      data: {
        chainId,
        address: args.address,
        client: thirdwebClient ? "connected" : "not configured"
      }
    };
  },

  async thirdweb_read_contract(args) {
    // This would use thirdweb's contract read functionality
    return {
      content: [{
        type: "text",
        text: `📖 Contract Read Prepared\nContract: ${args.address}\nMethod: ${args.method}\nParams: ${JSON.stringify(args.params || [])}`
      }],
      data: {
        contract: args.address,
        method: args.method,
        params: args.params || []
      }
    };
  },

  async thirdweb_get_gas_price(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    // Return RPC endpoints for gas price check
    const rpcUrls = {
      ethereum: "https://ethereum.publicnode.com",
      base: "https://mainnet.base.org",
      polygon: "https://polygon-rpc.com",
      arbitrum: "https://arb1.arbitrum.io/rpc",
      optimism: "https://mainnet.optimism.io"
    };

    return {
      content: [{
        type: "text",
        text: `⛽ Gas Price Check\nChain: ${args.chain} (ID: ${chainId})\nRPC: ${rpcUrls[args.chain] || "public RPC"}`
      }],
      data: {
        chain: args.chain,
        chainId,
        rpcUrl: rpcUrls[args.chain]
      }
    };
  },

  async thirdweb_estimate_gas(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `⛽ Gas Estimation Prepared\nChain: ${args.chain} (ID: ${chainId})\nTo: ${args.to}\nValue: ${args.value || "0"}`
      }],
      data: {
        chainId,
        to: args.to,
        value: args.value,
        data: args.data
      }
    };
  },

  async thirdweb_get_wallet_nfts(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `🎨 NFT Query Prepared\nChain: ${args.chain} (ID: ${chainId})\nContract: ${args.contractAddress || "All contracts"}`
      }],
      data: {
        chainId,
        contractAddress: args.contractAddress
      }
    };
  },

  async thirdweb_get_token_balance(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `💰 Token Balance Query\nChain: ${args.chain} (ID: ${chainId})\nToken: ${args.tokenAddress}\nWallet: ${args.walletAddress || "Kai's wallet"}`
      }],
      data: {
        chainId,
        tokenAddress: args.tokenAddress,
        walletAddress: args.walletAddress
      }
    };
  },

  async thirdweb_prepare_transaction(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `📝 Transaction Prepared\nChain: ${args.chain} (ID: ${chainId})\nTo: ${args.to}\nValue: ${args.value || "0"}`
      }],
      data: {
        chainId,
        to: args.to,
        value: args.value,
        data: args.data,
        prepared: true
      }
    };
  },

  async thirdweb_get_transaction_receipt(args) {
    const chainId = CHAIN_IDS[args.chain];
    
    return {
      content: [{
        type: "text",
        text: `📄 Transaction Receipt Query\nChain: ${args.chain} (ID: ${chainId})\nTx: ${args.txHash}`
      }],
      data: {
        chainId,
        txHash: args.txHash
      }
    };
  }
};

export { CHAIN_IDS };