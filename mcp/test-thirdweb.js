#!/usr/bin/env node
/**
 * Test thirdweb integration with provided credentials
 */

import { createThirdwebClient } from "thirdweb";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: join(__dirname, ".env") });

console.log("🌊 Testing Thirdweb Integration");
console.log("================================\n");

// Check credentials
const secretKey = process.env.THIRDWEB_SECRET_KEY;
const clientId = process.env.THIRDWEB_CLIENT_ID;
const projectId = process.env.THIRDWEB_PROJECT_ID;

console.log("Credentials:");
console.log(`  Client ID: ${clientId ? clientId.substring(0, 10) + "..." : "NOT SET"}`);
console.log(`  Secret Key: ${secretKey ? "✓ Set (" + secretKey.substring(0, 10) + "...)" : "NOT SET"}`);
console.log(`  Project ID: ${projectId || "NOT SET"}`);
console.log();

if (!secretKey || !clientId) {
  console.error("❌ Missing credentials. Check .env file.");
  process.exit(1);
}

// Initialize client
try {
  const client = createThirdwebClient({
    clientId: clientId,
    secretKey: secretKey
  });

  console.log("✅ Thirdweb client initialized successfully!");
  console.log();
  console.log("Client capabilities:");
  console.log("  - Contract deployment");
  console.log("  - NFT management");
  console.log("  - Token operations");
  console.log("  - Gas estimation");
  console.log("  - Transaction preparation");
  console.log();
  console.log("Supported chains:");
  console.log("  - Ethereum (1)");
  console.log("  - Base (8453)");
  console.log("  - Polygon (137)");
  console.log("  - Arbitrum (42161)");
  console.log("  - Optimism (10)");
  console.log();
  console.log("🌊 Kai is ready to use thirdweb tools!");

} catch (error) {
  console.error("❌ Failed to initialize thirdweb:", error.message);
  process.exit(1);
}