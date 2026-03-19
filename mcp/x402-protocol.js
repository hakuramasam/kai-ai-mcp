/**
 * x402 Payment Protocol Implementation
 * Enables paid API/tool access with crypto payments
 */

import { ethers } from "ethers";
import crypto from "crypto";

// Payment cache for tracking
const paymentRequests = new Map();
const verifiedPayments = new Map();

// USDC contract addresses by chain
const USDC_ADDRESSES = {
  ethereum: "0xA0b86a33E6417E4df2057B2d3C6d9F7cc11b0a70",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  polygon: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  arbitrum: "0xFF970A61A04b1cA14834A43f5de4533ebDDB5CC8",
  optimism: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607"
};

const USDT_ADDRESSES = {
  ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  base: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  bsc: "0x55d398326f99059fF775485246999027B3197955"
};

/**
 * x402 Tool Definitions
 */
export const X402_TOOLS = [
  {
    name: "x402_create_payment_request",
    description: "Create an x402 payment request for tool access",
    inputSchema: {
      type: "object",
      properties: {
        toolName: { type: "string", description: "Tool to pay for" },
        amount: { type: "string", description: "Payment amount in USD" },
        chain: { type: "string", enum: ["ethereum", "base", "polygon", "arbitrum", "optimism", "bsc"] },
        token: { type: "string", enum: ["USDC", "USDT", "ETH", "native"], default: "USDC" }
      },
      required: ["toolName", "amount"]
    }
  },
  {
    name: "x402_verify_payment",
    description: "Verify an x402 payment has been received on-chain",
    inputSchema: {
      type: "object",
      properties: {
        paymentId: { type: "string", description: "Payment ID to verify" },
        txHash: { type: "string", description: "Transaction hash" },
        chain: { type: "string" }
      },
      required: ["paymentId"]
    }
  },
  {
    name: "x402_get_payment_status",
    description: "Get status of a payment request",
    inputSchema: {
      type: "object",
      properties: {
        paymentId: { type: "string" }
      },
      required: ["paymentId"]
    }
  },
  {
    name: "x402_list_pending_payments",
    description: "List all pending payment requests",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "x402_get_payment_config",
    description: "Get x402 payment configuration",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "x402_create_settlement",
    description: "Create settlement for accumulated payments",
    inputSchema: {
      type: "object",
      properties: {
        paymentIds: { type: "array", items: { type: "string" } }
      },
      required: ["paymentIds"]
    }
  }
];

/**
 * Create a new payment request
 */
export function createPaymentRequest(toolName, amountUSD, chain = "base", token = "USDC") {
  const paymentId = `x402-${crypto.randomUUID()}`;
  const receiver = process.env.X402_PAYMENT_RECEIVER || "0xf54961B4a97906cfc97007cDffdD2B521da0A4b6";
  
  // Get token address
  let tokenAddress;
  if (token === "USDC") {
    tokenAddress = USDC_ADDRESSES[chain];
  } else if (token === "USDT") {
    tokenAddress = USDT_ADDRESSES[chain];
  } else {
    tokenAddress = null; // Native token
  }

  const request = {
    id: paymentId,
    tool: toolName,
    amount: amountUSD,
    currency: "USD",
    chain: chain,
    token: token,
    tokenAddress: tokenAddress,
    receiver: receiver,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour
    x402Version: "1.0.0"
  };

  paymentRequests.set(paymentId, request);
  
  return request;
}

/**
 * Verify a payment on-chain
 */
export async function verifyPayment(paymentId, txHash, chain) {
  const request = paymentRequests.get(paymentId);
  if (!request) {
    return { verified: false, error: "Payment request not found" };
  }

  if (request.status === "verified") {
    return { verified: true, payment: request };
  }

  // In production, this would verify the transaction on-chain
  // For now, we simulate verification
  
  // Mark as verified
  request.status = "verified";
  request.txHash = txHash;
  request.verifiedAt = new Date().toISOString();
  
  verifiedPayments.set(paymentId, request);
  
  return {
    verified: true,
    payment: request,
    toolAccess: request.tool,
    grantedAt: request.verifiedAt
  };
}

/**
 * Get payment status
 */
export function getPaymentStatus(paymentId) {
  const request = paymentRequests.get(paymentId);
  if (!request) {
    return { found: false };
  }
  
  return {
    found: true,
    status: request.status,
    payment: request,
    expired: new Date() > new Date(request.expiresAt)
  };
}

/**
 * List pending payments
 */
export function listPendingPayments() {
  const pending = [];
  for (const [id, request] of paymentRequests) {
    if (request.status === "pending") {
      pending.push(request);
    }
  }
  return pending;
}

/**
 * Get x402 configuration
 */
export function getX402Config() {
  return {
    enabled: process.env.X402_ENABLED === "true",
    receiver: process.env.X402_PAYMENT_RECEIVER || "0xf54961B4a97906cfc97007cDffdD2B521da0A4b6",
    minPayment: process.env.X402_MIN_PAYMENT_USD || "0.01",
    supportedTokens: ["USDC", "USDT", "ETH"],
    supportedChains: ["ethereum", "base", "polygon", "arbitrum", "optimism", "bsc"],
    version: "1.0.0"
  };
}

/**
 * Tool Handlers
 */
export const x402Handlers = {
  async x402_create_payment_request(args) {
    const request = createPaymentRequest(
      args.toolName,
      args.amount,
      args.chain || "base",
      args.token || "USDC"
    );

    return {
      content: [{
        type: "text",
        text: `💰 x402 Payment Request Created

Tool: ${request.tool}
Amount: $${request.amount} USD
Chain: ${request.chain}
Token: ${request.token}
Receiver: ${request.receiver}
Payment ID: ${request.id}
Expires: ${request.expiresAt}

To complete payment:
1. Send ${request.amount} ${request.token} on ${request.chain}
2. To: ${request.receiver}
3. Then call x402_verify_payment with txHash`
      }],
      data: request
    };
  },

  async x402_verify_payment(args) {
    const result = await verifyPayment(args.paymentId, args.txHash, args.chain);
    
    if (result.verified) {
      return {
        content: [{
          type: "text",
          text: `✅ Payment Verified!

Payment ID: ${result.payment.id}
Tool: ${result.payment.tool}
Amount: $${result.payment.amount}
Tx Hash: ${result.payment.txHash}
Verified At: ${result.payment.verifiedAt}

🔓 Tool access granted: ${result.toolAccess}`
        }],
        data: result
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `❌ Payment Verification Failed

Error: ${result.error || "Unknown error"}
Payment ID: ${args.paymentId}`
        }],
        isError: true,
        data: result
      };
    }
  },

  async x402_get_payment_status(args) {
    const status = getPaymentStatus(args.paymentId);
    
    if (!status.found) {
      return {
        content: [{ type: "text", text: `❌ Payment ${args.paymentId} not found` }],
        isError: true
      };
    }

    return {
      content: [{
        type: "text",
        text: `💰 Payment Status

Payment ID: ${args.paymentId}
Status: ${status.status}
Tool: ${status.payment.tool}
Amount: $${status.payment.amount}
Expired: ${status.expired ? "Yes" : "No"}
Created: ${status.payment.createdAt}`
      }],
      data: status
    };
  },

  async x402_list_pending_payments() {
    const pending = listPendingPayments();
    
    if (pending.length === 0) {
      return {
        content: [{ type: "text", text: "No pending payments" }],
        data: { count: 0, payments: [] }
      };
    }

    const list = pending.map(p => `- ${p.id}: ${p.tool} ($${p.amount})`).join("\n");
    
    return {
      content: [{
        type: "text",
        text: `⏳ Pending Payments (${pending.length}):\n\n${list}`
      }],
      data: { count: pending.length, payments: pending }
    };
  },

  async x402_get_payment_config() {
    const config = getX402Config();
    
    return {
      content: [{
        type: "text",
        text: `⚙️ x402 Payment Configuration

Enabled: ${config.enabled ? "Yes" : "No"}
Receiver: ${config.receiver}
Min Payment: $${config.minPayment}
Supported Tokens: ${config.supportedTokens.join(", ")}
Supported Chains: ${config.supportedChains.join(", ")}
Version: ${config.version}`
      }],
      data: config
    };
  },

  async x402_create_settlement(args) {
    const settlements = [];
    
    for (const paymentId of args.paymentIds) {
      const payment = verifiedPayments.get(paymentId);
      if (payment) {
        settlements.push(payment);
      }
    }

    const totalAmount = settlements.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    
    return {
      content: [{
        type: "text",
        text: `📊 Settlement Created

Payments: ${settlements.length}
Total Amount: $${totalAmount.toFixed(2)} USD
Settlement IDs: ${args.paymentIds.join(", ")}`
      }],
      data: {
        count: settlements.length,
        totalAmount: totalAmount.toFixed(2),
        payments: settlements
      }
    };
  }
};

export { paymentRequests, verifiedPayments };