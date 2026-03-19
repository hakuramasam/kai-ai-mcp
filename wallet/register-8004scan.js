#!/usr/bin/env node
/**
 * Kai's 8004scan.io Registration Helper
 * Signs registration messages for wallet verification
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const CONFIG_FILE = path.join(__dirname, 'wallet.json');

class KaiWallet {
  constructor() {
    this.wallet = null;
    this.config = null;
  }

  async load() {
    if (!fs.existsSync(CONFIG_FILE)) {
      throw new Error('Wallet not found. Run create-wallet.js first.');
    }

    this.config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    
    if (this.config._template) {
      throw new Error('Wallet is not encrypted. Set KAI_WALLET_KEY and run create-wallet.js again.');
    }

    const encryptionKey = process.env.KAI_WALLET_KEY;
    if (!encryptionKey) {
      throw new Error('KAI_WALLET_KEY environment variable not set');
    }

    const { encrypted } = this.config;
    const key = crypto.scryptSync(encryptionKey, 'kai-wallet-salt', 32);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encrypted.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));

    let decrypted = decipher.update(encrypted.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const sensitiveData = JSON.parse(decrypted);
    this.wallet = new ethers.Wallet(sensitiveData.privateKey);
    
    return this;
  }

  getAddress() {
    return this.wallet.address;
  }

  async signMessage(message) {
    return await this.wallet.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    return await this.wallet.signTypedData(domain, types, value);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const wallet = new KaiWallet();

  try {
    await wallet.load();

    const address = wallet.getAddress();
    console.log('🌊 Kai - 8004scan.io Registration');
    console.log('==================================');
    console.log(`Wallet Address: ${address}`);
    console.log('');

    switch (command) {
      case 'sign-auth':
        // Sign a standard authentication message
        const timestamp = Math.floor(Date.now() / 1000);
        const authMessage = `8004scan.io authentication\nAddress: ${address}\nTimestamp: ${timestamp}`;
        
        console.log('Signing authentication message...');
        console.log('');
        console.log('Message to sign:');
        console.log('----------------');
        console.log(authMessage);
        console.log('----------------');
        console.log('');
        
        const authSignature = await wallet.signMessage(authMessage);
        
        console.log('✓ Message signed!');
        console.log('');
        console.log('Signature:');
        console.log(authSignature);
        console.log('');
        console.log('Submit this to 8004scan.io:');
        console.log(JSON.stringify({
          address: address,
          message: authMessage,
          signature: authSignature,
          timestamp: timestamp
        }, null, 2));
        break;

      case 'sign-custom':
        const customMessage = args[1];
        if (!customMessage) {
          console.error('Usage: register-8004scan.js sign-custom "Your message here"');
          process.exit(1);
        }
        
        console.log('Signing custom message...');
        console.log('Message:', customMessage);
        console.log('');
        
        const customSignature = await wallet.signMessage(customMessage);
        
        console.log('✓ Message signed!');
        console.log('');
        console.log('Signature:', customSignature);
        break;

      case 'sign-terms':
        // Sign terms of service agreement
        const termsMessage = `I agree to the 8004scan.io Terms of Service\nAddress: ${address}\nDate: ${new Date().toISOString()}`;
        
        console.log('Signing Terms of Service agreement...');
        console.log('');
        console.log('Message:');
        console.log('--------');
        console.log(termsMessage);
        console.log('--------');
        console.log('');
        
        const termsSignature = await wallet.signMessage(termsMessage);
        
        console.log('✓ Terms signed!');
        console.log('');
        console.log('Signature:', termsSignature);
        break;

      case 'verify-ownership':
        // Create a verification payload for 8004scan.io
        const nonce = `kai-${Date.now()}`;
        const verifyMessage = `Verify wallet ownership for 8004scan.io\nAddress: ${address}\nNonce: ${nonce}`;
        
        console.log('Creating ownership verification...');
        console.log('');
        console.log('Message:');
        console.log('--------');
        console.log(verifyMessage);
        console.log('--------');
        console.log('');
        
        const verifySignature = await wallet.signMessage(verifyMessage);
        
        console.log('✓ Ownership verified!');
        console.log('');
        console.log('Submit to 8004scan.io:');
        console.log(JSON.stringify({
          action: 'verify_ownership',
          address: address,
          message: verifyMessage,
          signature: verifySignature,
          nonce: nonce
        }, null, 2));
        break;

      default:
        console.log('Commands:');
        console.log('  sign-auth          - Sign authentication message');
        console.log('  sign-custom "msg"  - Sign a custom message');
        console.log('  sign-terms         - Sign Terms of Service');
        console.log('  verify-ownership   - Create ownership verification');
        console.log('');
        console.log('Usage:');
        console.log('  export KAI_WALLET_KEY="your-password"');
        console.log('  node register-8004scan.js sign-auth');
        console.log('');
        console.log('Then submit the signature to 8004scan.io registration page.');
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { KaiWallet };

if (require.main === module) {
  main();
}