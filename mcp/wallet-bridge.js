#!/usr/bin/env node
/**
 * Wallet Bridge - Connects MCP server to Kai's encrypted wallet
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WALLET_DIR = path.join(__dirname, '..', 'wallet');
const CONFIG_FILE = path.join(WALLET_DIR, 'wallet.json');
const CHAINS_FILE = path.join(WALLET_DIR, 'chains.json');

// Load chain configurations
const CHAINS = JSON.parse(fs.readFileSync(CHAINS_FILE, 'utf8'));

export class KaiWallet {
  constructor() {
    this.wallet = null;
    this.provider = null;
    this.config = null;
    this.currentChain = null;
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
    this.mnemonic = sensitiveData.mnemonic;

    return this;
  }

  connect(chainName, rpcProvider = 'public') {
    if (!this.wallet) {
      throw new Error('Wallet not loaded. Call load() first.');
    }

    const chain = CHAINS[chainName.toLowerCase()];
    if (!chain) {
      throw new Error(`Unknown chain: ${chainName}. Available: ${Object.keys(CHAINS).join(', ')}`);
    }

    let rpcUrl = chain.rpc[rpcProvider] || chain.rpc.public;
    rpcUrl = rpcUrl.replace('${ALCHEMY_KEY}', process.env.ALCHEMY_KEY || '');
    rpcUrl = rpcUrl.replace('${INFURA_KEY}', process.env.INFURA_KEY || '');

    this.provider = new ethers.JsonRpcProvider(rpcUrl, {
      name: chain.name,
      chainId: chain.chainId
    });
    
    this.wallet = this.wallet.connect(this.provider);
    this.currentChain = chain;
    
    return this;
  }

  getAddress() {
    if (!this.wallet) {
      throw new Error('Wallet not loaded');
    }
    return this.wallet.address;
  }

  async getBalance() {
    if (!this.provider) {
      throw new Error('Not connected to a network. Call connect() first.');
    }
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  async getTokenBalance(tokenAddress) {
    if (!this.provider) {
      throw new Error('Not connected to a network');
    }

    const erc20Abi = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];

    const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
    const [balance, decimals, symbol] = await Promise.all([
      contract.balanceOf(this.wallet.address),
      contract.decimals(),
      contract.symbol()
    ]);

    return {
      raw: balance.toString(),
      formatted: ethers.formatUnits(balance, decimals),
      symbol,
      decimals
    };
  }

  async sendTransaction(to, amount, options = {}) {
    if (!this.provider) {
      throw new Error('Not connected to a network. Call connect() first.');
    }

    const tx = {
      to: to,
      value: ethers.parseEther(amount.toString()),
      ...options
    };

    const symbol = this.currentChain?.nativeCurrency?.symbol || 'ETH';
    console.log(`🌊 Kai is preparing transaction...`);
    console.log(`   Network: ${this.currentChain?.name || 'Unknown'}`);
    console.log(`   To:      ${to}`);
    console.log(`   Amount:  ${amount} ${symbol}`);
    console.log(`   From:    ${this.wallet.address}`);

    const transaction = await this.wallet.sendTransaction(tx);
    console.log(`✓ Transaction sent: ${transaction.hash}`);
    
    return transaction;
  }

  async sendToken(tokenAddress, to, amount) {
    if (!this.provider) {
      throw new Error('Not connected to a network');
    }

    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)'
    ];

    const contract = new ethers.Contract(tokenAddress, erc20Abi, this.wallet);
    const decimals = await contract.decimals();
    const symbol = await contract.symbol();
    const parsedAmount = ethers.parseUnits(amount.toString(), decimals);

    console.log(`🌊 Kai is preparing token transfer...`);
    console.log(`   Network: ${this.currentChain?.name || 'Unknown'}`);
    console.log(`   Token:   ${symbol}`);
    console.log(`   To:      ${to}`);
    console.log(`   Amount:  ${amount} ${symbol}`);

    const tx = await contract.transfer(to, parsedAmount);
    console.log(`✓ Transaction sent: ${tx.hash}`);

    return tx;
  }

  async waitForConfirmation(txHash, confirmations = 1) {
    if (!this.provider) {
      throw new Error('Not connected to a network');
    }
    console.log(`🌊 Waiting for ${confirmations} confirmation(s)...`);
    const receipt = await this.provider.waitForTransaction(txHash, confirmations);
    console.log(`✓ Confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  async signMessage(message) {
    if (!this.wallet) {
      throw new Error('Wallet not loaded');
    }
    return await this.wallet.signMessage(message);
  }

  async signTypedData(domain, types, value) {
    if (!this.wallet) {
      throw new Error('Wallet not loaded');
    }
    return await this.wallet.signTypedData(domain, types, value);
  }

  getInfo() {
    if (!this.config) {
      throw new Error('Wallet not loaded');
    }
    return {
      address: this.config.address,
      created: this.config.created,
      version: this.config.version,
      chains: Object.keys(CHAINS)
    };
  }

  getChainInfo() {
    return this.currentChain;
  }

  async estimateGas(to, amount) {
    if (!this.provider) {
      throw new Error('Not connected to a network');
    }
    const tx = {
      to: to,
      value: ethers.parseEther(amount.toString())
    };
    const estimate = await this.provider.estimateGas(tx);
    return estimate.toString();
  }
}

export { CHAINS };