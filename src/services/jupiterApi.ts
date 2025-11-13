import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { createJupiterApiClient, QuoteResponse } from '@jup-ag/api';

// Configuration
const JUPITER_API_KEY = import.meta.env.VITE_JUPITER_API_KEY as string;
const PPA_TOKEN_ADDRESS = '51NRTtZ8GwG3J4MGmxTsGJAdLViwu9s5ggEQup35pump';
const SOL_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111112';

// Create Jupiter API client with Pro API key
const jupiterQuoteApi = createJupiterApiClient({
  basePath: 'https://api.jup.ag',
  headers: {
    'Authorization': `Bearer ${JUPITER_API_KEY}`,
  },
});

// Use Jupiter's native QuoteResponse type

export interface SwapResult {
  txid: string;
  inputAmount: number;
  outputAmount: number;
  feeAmount: number;
}

export type SwapDirection = 'SOL_TO_PPA' | 'PPA_TO_SOL';

export class JupiterSwapService {
  private connection: Connection;

  constructor() {
    this.connection = new Connection('https://rpc.ankr.com/solana', {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }

  /**
   * Get swap quote using Jupiter API v6 - basic implementation
   */
  async getSwapQuoteWithDirection(
    inputAmount: number, 
    direction: SwapDirection
  ): Promise<QuoteResponse | null> {
    try {
      let inputMint: string;
      let outputMint: string;
      let amountInSmallestUnit: number;

      // Configure swap based on direction
      switch (direction) {
        case 'SOL_TO_PPA':
          inputMint = SOL_TOKEN_ADDRESS;
          outputMint = PPA_TOKEN_ADDRESS;
          amountInSmallestUnit = Math.floor(inputAmount * 1_000_000_000); // SOL has 9 decimals
          break;
        case 'PPA_TO_SOL':
          inputMint = PPA_TOKEN_ADDRESS;
          outputMint = SOL_TOKEN_ADDRESS;
          amountInSmallestUnit = Math.floor(inputAmount * 1_000_000); // PPA has 6 decimals
          break;
        default:
          throw new Error('Invalid swap direction');
      }

      console.log(`🔄 Getting Jupiter quote for: ${inputAmount} ${direction}`);
      console.log(`📊 Amount in smallest unit: ${amountInSmallestUnit}`);

      // Basic quote request - following Jupiter docs exactly
      const quoteRequest = {
        inputMint,
        outputMint,
        amount: amountInSmallestUnit,
        slippageBps: 50, // 0.5% slippage
      };

      console.log('📋 Quote request:', quoteRequest);

      // Get quote from Jupiter API
      const quote = await jupiterQuoteApi.quoteGet(quoteRequest);
      
      if (!quote) {
        console.error('❌ No quote received from Jupiter');
        return null;
      }

      console.log('✅ Quote received:', quote);
      console.log('📊 Quote properties:', Object.keys(quote));
      console.log('📊 inAmount:', quote.inAmount);
      console.log('📊 outAmount:', quote.outAmount);

      // Return the quote in the format expected by the swap API
      return quote;

    } catch (error) {
      console.error('💥 Error getting Jupiter quote:', error);
      return null;
    }
  }

  /**
   * Execute swap using Jupiter API v6 - basic implementation following docs
   */
  async executeSwap(
    quote: QuoteResponse,
    userPublicKey: PublicKey,
    signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction>
  ): Promise<SwapResult | null> {
    try {
      console.log('🚀 Executing swap with quote:', quote);

      // Basic swap request - following Jupiter docs exactly
      const swapRequest = {
        quoteResponse: quote,
        userPublicKey: userPublicKey.toString(),
        wrapAndUnwrapSol: true,
      };

      console.log('📋 Swap request prepared');

      // Get swap transaction from Jupiter API
      const swapResponse = await jupiterQuoteApi.swapPost({ swapRequest });
      
      if (!swapResponse.swapTransaction) {
        console.error('❌ No swap transaction received');
        return null;
      }

      console.log('✅ Swap transaction received from Jupiter');

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      console.log('🔐 Requesting transaction signature...');

      // Sign the transaction
      const signedTransaction = await signTransaction(transaction);

      console.log('📡 Sending transaction to network...');

      // Send the transaction
      const rawTransaction = signedTransaction.serialize();
      const txid = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });

      console.log('⏳ Confirming transaction:', txid);

      // Confirm the transaction
      const confirmation = await this.connection.confirmTransaction(txid, 'confirmed');
      
      if (confirmation.value.err) {
        console.error('❌ Transaction failed:', confirmation.value.err);
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log('✅ Transaction confirmed:', txid);

      // Calculate amounts for display
      let inputAmount: number;
      let outputAmount: number;

      if (quote.inputMint === SOL_TOKEN_ADDRESS) {
        inputAmount = parseInt(quote.inAmount) / 1_000_000_000; // SOL has 9 decimals
      } else {
        inputAmount = parseInt(quote.inAmount) / 1_000_000; // PPA has 6 decimals
      }

      if (quote.outputMint === SOL_TOKEN_ADDRESS) {
        outputAmount = parseInt(quote.outAmount) / 1_000_000_000; // SOL has 9 decimals
      } else {
        outputAmount = parseInt(quote.outAmount) / 1_000_000; // PPA has 6 decimals
      }

      return {
        txid,
        inputAmount,
        outputAmount,
        feeAmount: 0, // No platform fees on swaps
      };

    } catch (error) {
      console.error('💥 Error executing swap:', error);
      throw error;
    }
  }

  /**
   * Get PPA price in SOL (how many PPA per 1 SOL)
   */
  async getPPAPrice(): Promise<number | null> {
    try {
      const quote = await this.getSwapQuoteWithDirection(1, 'SOL_TO_PPA');
      
      if (!quote) {
        return null;
      }

      const inputAmount = parseInt(quote.inAmount) / 1_000_000_000; // SOL
      const outputAmount = parseInt(quote.outAmount) / 1_000_000; // PPA
      
      return outputAmount / inputAmount;

    } catch (error) {
      console.error('💥 Error getting PPA price:', error);
      return null;
    }
  }

  /**
   * Get current exchange rate for display
   */
  async getExchangeRate(direction: SwapDirection): Promise<string | null> {
    try {
      if (direction === 'SOL_TO_PPA') {
        const quote = await this.getSwapQuoteWithDirection(1, 'SOL_TO_PPA');
        if (quote) {
          const inputSOL = parseInt(quote.inAmount) / 1_000_000_000;
          const outputPPA = parseInt(quote.outAmount) / 1_000_000;
          const rate = outputPPA / inputSOL;
          return `1 SOL ≈ ${rate.toLocaleString('en-US', { maximumFractionDigits: 0 })} PPA`;
        }
      } else if (direction === 'PPA_TO_SOL') {
        const quote = await this.getSwapQuoteWithDirection(1000, 'PPA_TO_SOL'); // Use 1000 PPA for better precision
        if (quote) {
          const inputPPA = parseInt(quote.inAmount) / 1_000_000;
          const outputSOL = parseInt(quote.outAmount) / 1_000_000_000;
          const rate = outputSOL / inputPPA;
          return `1 PPA ≈ ${rate.toFixed(8)} SOL`;
        }
      }
      return null;
    } catch (error) {
      console.error('💥 Error getting exchange rate:', error);
      return null;
    }
  }

  /**
   * Validate SOL balance
   */
  async validateSOLBalance(
    userPublicKey: PublicKey, 
    requiredAmount: number
  ): Promise<boolean> {
    try {
      const balance = await this.connection.getBalance(userPublicKey);
      const solBalance = balance / 1_000_000_000;
      console.log('💰 SOL Balance:', solBalance);
      
      const totalNeeded = requiredAmount + 0.01; // Include transaction fees
      console.log(`💰 Required: ${requiredAmount}, Total needed: ${totalNeeded}`);
      
      return solBalance >= totalNeeded;

    } catch (error) {
      console.error('💥 Error checking SOL balance:', error);
      return false;
    }
  }

  /**
   * Format token amounts for display
   */
  formatTokenAmount(amount: string | number | undefined, tokenMint?: string): string {
    // Handle undefined, null, or invalid inputs
    if (!amount || amount === '' || amount === 'undefined') {
      return '0';
    }

    let decimals = 6; // Default for PPA
    
    if (tokenMint === SOL_TOKEN_ADDRESS || tokenMint === 'SOL') {
      decimals = 9; // SOL has 9 decimals
    }

    // Convert to number safely
    let amountNum: number;
    if (typeof amount === 'string') {
      amountNum = parseInt(amount);
    } else {
      amountNum = amount;
    }

    // Check for NaN after parsing
    if (isNaN(amountNum) || !isFinite(amountNum)) {
      return '0';
    }

    const num = amountNum / Math.pow(10, decimals);
    
    // Check for NaN after division
    if (isNaN(num) || !isFinite(num)) {
      return '0';
    }
    
    // Better formatting based on token type
    if (tokenMint === SOL_TOKEN_ADDRESS || tokenMint === 'SOL') {
      // SOL formatting - show up to 4 decimal places
      return num.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 4 
      });
    } else {
      // PPA formatting - show appropriate decimal places based on size
      if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
      } else {
        return num.toLocaleString('en-US', { 
          minimumFractionDigits: 0, 
          maximumFractionDigits: 2 
        });
      }
    }
  }

  /**
   * Get user balances
   */
  async getUserBalances(userPublicKey: PublicKey): Promise<{
    sol: number;
    ppa: number;
  }> {
    let sol = 0;
    let ppa = 0;

    try {
      // Get SOL balance
      const solBalance = await this.connection.getBalance(userPublicKey);
      sol = solBalance / 1_000_000_000;

      // Get PPA balance
      try {
        const ppaAccounts = await this.connection.getParsedTokenAccountsByOwner(
          userPublicKey,
          { mint: new PublicKey(PPA_TOKEN_ADDRESS) }
        );
        if (ppaAccounts.value.length > 0) {
          ppa = ppaAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch PPA balance:', error);
        ppa = 0;
      }

      console.log('💰 Balances - SOL:', sol, 'PPA:', ppa);
      return { sol, ppa };

    } catch (error) {
      console.error('💥 Error getting user balances:', error);
      return { sol: 0, ppa: 0 };
    }
  }
}

// Export singleton instance
export const jupiterSwapService = new JupiterSwapService();