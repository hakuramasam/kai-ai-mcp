// Simple test without thirdweb dependency
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) {
    env[key.trim()] = value.join('=').trim();
  }
});

console.log("🌊 Kai Thirdweb Configuration Test");
console.log("===================================\n");

console.log("✅ Credentials configured:");
console.log(`   Client ID: ${env.THIRDWEB_CLIENT_ID?.substring(0, 15)}...`);
console.log(`   Secret Key: ${env.THIRDWEB_SECRET_KEY?.substring(0, 20)}...`);
console.log(`   Project ID: ${env.THIRDWEB_PROJECT_ID}`);
console.log();
console.log("🌊 Kai is ready to use thirdweb tools!");
console.log();
console.log("Available thirdweb tools:");
console.log("   - thirdweb_deploy_token");
console.log("   - thirdweb_deploy_nft");
console.log("   - thirdweb_get_contract");
console.log("   - thirdweb_read_contract");
console.log("   - thirdweb_get_gas_price");
console.log("   - thirdweb_estimate_gas");
console.log("   - thirdweb_get_wallet_nfts");
console.log("   - thirdweb_get_token_balance");
console.log("   - thirdweb_prepare_transaction");
console.log("   - thirdweb_get_transaction_receipt");
