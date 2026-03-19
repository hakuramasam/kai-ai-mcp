#!/usr/bin/env node
/**
 * Kai's Wallet Generator
 * Creates a new Ethereum wallet with encrypted storage
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const WALLET_DIR = __dirname;
const WALLET_FILE = path.join(WALLET_DIR, 'wallet.enc');
const CONFIG_FILE = path.join(WALLET_DIR, 'wallet.json');

// Generate a new random wallet
const wallet = ethers.Wallet.createRandom();

console.log('🌊 Kai Wallet Generated');
console.log('======================');
console.log(`Address: ${wallet.address}`);
console.log(`Path:    ${wallet.path || "m/44'/60'/0'/0/0"}`);
console.log('');

// Create wallet data structure
const walletData = {
  version: 1,
  created: new Date().toISOString(),
  address: wallet.address,
  // Encrypted fields will be added below
};

// Generate encryption key from environment or prompt
// For now, we'll create a template that expects ENCRYPTION_KEY
const encryptionKey = process.env.KAI_WALLET_KEY;

if (!encryptionKey) {
  console.log('⚠️  No KAI_WALLET_KEY environment variable set.');
  console.log('   Set it to encrypt the private key securely.');
  console.log('');
  console.log('   Example: export KAI_WALLET_KEY="your-strong-password-here"');
  console.log('');
  console.log('   Without encryption, the wallet will be stored in a template format.');
  console.log('');
  
  // Create unencrypted template (for setup purposes)
  walletData._template = true;
  walletData._note = 'Set KAI_WALLET_KEY and run again to encrypt';
  walletData.mnemonic = wallet.mnemonic.phrase;
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(walletData, null, 2));
  console.log(`✓ Wallet config saved: ${CONFIG_FILE}`);
  console.log('');
  console.log('🔐 IMPORTANT: Back up your mnemonic phrase securely!');
  console.log('   This is the ONLY way to recover your wallet.');
  console.log('');
  console.log('Mnemonic:');
  console.log('--------');
  console.log(wallet.mnemonic.phrase);
  console.log('--------');
  console.log('');
  console.log('⚠️  Store this in a safe place. Never share it.');
  process.exit(0);
}

// Encrypt the private key and mnemonic
const iv = crypto.randomBytes(16);
const key = crypto.scryptSync(encryptionKey, 'kai-wallet-salt', 32);
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

const sensitiveData = JSON.stringify({
  privateKey: wallet.privateKey,
  mnemonic: wallet.mnemonic.phrase
});

let encrypted = cipher.update(sensitiveData, 'utf8', 'hex');
encrypted += cipher.final('hex');
const authTag = cipher.getAuthTag();

// Store encrypted data
walletData.encrypted = {
  data: encrypted,
  iv: iv.toString('hex'),
  authTag: authTag.toString('hex'),
  algorithm: 'aes-256-gcm'
};

fs.writeFileSync(CONFIG_FILE, JSON.stringify(walletData, null, 2));

console.log('✓ Wallet encrypted and saved');
console.log(`  Config: ${CONFIG_FILE}`);
console.log('');
console.log(`Address: ${wallet.address}`);
console.log('');
console.log('🔐 Wallet is encrypted. Use wallet.js to interact with it.');
console.log('   Set KAI_WALLET_KEY environment variable to decrypt.');