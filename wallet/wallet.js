#!/usr/bin/env node
/**
 * Kai's Multi-Chain Wallet Interface
 * Secure wallet operations for Ethereum, BSC, Base, and Monad
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ethers } = require('ethers');

const CONFIG_FILE = path.join(__dirname, 'wallet.json');
const CHAINS_FILE = path.join(__dirname, 'chains.json');

// Load chain configurations
const CHAINS = JSON.parse(fs.readFileSync(CHAINS_FILE, 'utf8'));

class KaiWallet {
  constructor() {
    this.wallet = null;
    this.provider = null;
    this.config = null;
    this.currentChain = null;
  }

  /**
   * Load and decrypt wallet
   */
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

    // Decrypt sensitive data
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

  /**
   * Connect to a specific chain
   */
  connect(chainName, rpcProvider = 'public') {
    if (!this.wallet) {
      throw new Error('Wallet not loaded. Call load() first.');
    }

    const chain = CHAINS[chainName.toLowerCase()];
    if (!chain) {
      throw new Error(`Unknown chain: ${chainName}. Available: ${Object.keys(CHAINS).join(', ')}`);
    }

    // Get RPC URL with environment variable substitution
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

  /**
   * Get wallet address
   */
  getAddress() {
    if (!this.wallet) {
      throw new Error('Wallet not loaded');
    }
    return this.wallet.address;
  }

  /**
   * Get native balance
   */
  async getBalance() {
    if (!this.provider) {
      throw new Error('Not connected to a network. Call connect() first.');
    }
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Get ERC-20 token balance
   */
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

  /**
   * Send native currency transaction
   */
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

  /**
   * Send ERC-20 token transaction
   */
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

  /**
   * Wait for transaction confirmation
   */
  async waitForConfirmation(txHash, confirmations = 1) {
    if (!this.provider) {
      throw new Error('Not connected to a network');
    }
    console.log(`🌊 Waiting for ${confirmations} confirmation(s)...`);
    const receipt = await this.provider.waitForTransaction(txHash, confirmations);
    console.log(`✓ Confirmed in block ${receipt.blockNumber}`);
    return receipt;
  }

  /**
   * Sign a message
   */
  async signMessage(message) {
    if (!this.wallet) {
      throw new Error('Wallet not loaded');
    }
    return await this.wallet.signMessage(message);
  }

  /**
   * Sign typed data (EIP-712)
   */
  async signTypedData(domain, types, value) {
    if (!this.wallet) {
      throw new Error('Wallet not loaded');
    }
    return await this.wallet.signTypedData(domain, types, value);
  }

  /**
   * Get wallet info (safe to display)
   */
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

  /**
   * Get current chain info
   */
  getChainInfo() {
    return this.currentChain;
  }

  /**
   * Estimate gas for a transaction
   */
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

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const wallet = new KaiWallet();

  try {
    switch (command) {
      case 'info':
        await wallet.load();
        const info = wallet.getInfo();
        console.log('🌊 Kai Multi-Chain Wallet');
        console.log('=========================');
        console.log(`Address:   ${info.address}`);
        console.log(`Created:   ${info.created}`);
        console.log(`Version:   ${info.version}`);
        console.log(`Chains:    ${info.chains.join(', ')}`);
        break;

      case 'balance':
        const chainName = args[1] || 'ethereum';
        await wallet.load();
        wallet.connect(chainName);
        const balance = await wallet.getBalance();
        const chain = wallet.getChainInfo();
        console.log(`🌊 Balance on ${chain.name}`);
        console.log(`   Address: ${wallet.getAddress()}`);
        console.log(`   Balance: ${balance} ${chain.nativeCurrency.symbol}`);
        break;

      case 'token-balance':
        const [tokenChain, tokenAddress] = args.slice(1);
        if (!tokenChain || !tokenAddress) {
          console.error('Usage: wallet.js token-balance <chain> <token-address>');
          process.exit(1);
        }
        await wallet.load();
        wallet.connect(tokenChain);
        const tokenBal = await wallet.getTokenBalance(tokenAddress);
        console.log(`🌊 Token Balance on ${wallet.getChainInfo().name}`);
        console.log(`   Token:   ${tokenBal.symbol}`);
        console.log(`   Balance: ${tokenBal.formatted} ${tokenBal.symbol}`);
        break;

      case 'send':
        const [sendChain, to, amount] = args.slice(1);
        if (!sendChain || !to || !amount) {
          console.error('Usage: wallet.js send <chain> <to-address> <amount>');
          console.error('Example: wallet.js send base 0x... 0.01');
          process.exit(1);
        }
        await wallet.load();
        wallet.connect(sendChain);
        const tx = await wallet.sendTransaction(to, amount);
        const explorer = wallet.getChainInfo()?.explorer;
        console.log(`\nTransaction Hash: ${tx.hash}`);
        if (explorer) {
          console.log(`Explorer: ${explorer}/tx/${tx.hash}`);
        }
        break;

      case 'send-token':
        const [sendTokenChain, sendTokenAddr, sendTo, sendAmount] = args.slice(1);
        if (!sendTokenChain || !sendTokenAddr || !sendTo || !sendAmount) {
          console.error('Usage: wallet.js send-token <chain> <token-address> <to> <amount>');
          process.exit(1);
        }
        await wallet.load();
        wallet.connect(sendTokenChain);
        const tokenTx = await wallet.sendToken(sendTokenAddr, sendTo, sendAmount);
        const tokenExplorer = wallet.getChainInfo()?.explorer;
        console.log(`\nTransaction Hash: ${tokenTx.hash}`);
        if (tokenExplorer) {
          console.log(`Explorer: ${tokenExplorer}/tx/${tokenTx.hash}`);
        }
        break;

      case 'sign':
        const message = args[1];
        if (!message) {
          console.error('Usage: wallet.js sign <message>');
          process.exit(1);
        }
        await wallet.load();
        const signature = await wallet.signMessage(message);
        console.log(`🌊 Message signed`);
        console.log(`   Signature: ${signature}`);
        break;

      case 'chains':
        console.log('🌊 Supported Chains');
        console.log('====================');
        for (const [key, chain] of Object.entries(CHAINS)) {
          console.log(`\n${key}:`);
          console.log(`  Name:     ${chain.name}`);
          console.log(`  Chain ID: ${chain.chainId}`);
          console.log(`  Currency: ${chain.nativeCurrency.symbol}`);
          console.log(`  Explorer: ${chain.explorer}`);
        }
        break;

      default:
        console.log('🌊 Kai Multi-Chain Wallet');
        console.log('');
        console.log('Commands:');
        console.log('  info                          - Show wallet info');
        console.log('  balance <chain>               - Check native balance');
        console.log('  token-balance <chain> <addr>  - Check ERC-20 balance');
        console.log('  send <chain> <to> <amt>       - Send native currency');
        console.log('  send-token <chain> <token> <to> <amt> - Send ERC-20 tokens');
        console.log('  sign <message>                - Sign a message');
        console.log('  chains                        - List supported chains');
        console.log('');
        console.log('Supported chains: ethereum, sepolia, bsc, base, monad');
        console.log('');
        console.log('Environment variables:');
        console.log('  KAI_WALLET_KEY  - Encryption key (required)');
        console.log('  ALCHEMY_KEY     - Alchemy API key (optional)');
        console.log('  INFURA_KEY      - Infura API key (optional)');
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Export for use as module
module.exports = { KaiWallet, CHAINS };

// Run CLI if called directly
if (require.main === module) {
  main();
}