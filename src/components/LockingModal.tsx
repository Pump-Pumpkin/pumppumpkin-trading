import React, { useState } from 'react';
import { X, Lock, Wallet, AlertTriangle, Loader2, TrendingUp } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { soundManager } from '../services/soundManager';
import { ppaLocksService } from '../services/supabaseClient';

interface LockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPPABalance: number;
  ppaPrice: number; // PPA price in SOL
  onLockPPA?: (amount: number, lockPeriod: number) => void;
}

// Platform wallet address for receiving PPA tokens
const PLATFORM_WALLET = 'CTDZ5teoWajqVcAsWQyEmmvHQzaDiV1jrnvwRmcL1iWv';
// PPA token address
const PPA_TOKEN_ADDRESS = '51NRTtZ8GwG3J4MGmxTsGJAdLViwu9s5ggEQup35pump';

export default function LockingModal({ isOpen, onClose, userPPABalance, ppaPrice, onLockPPA }: LockingModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState('');
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const [isLocking, setIsLocking] = useState(false);
  const [lockingStep, setLockingStep] = useState<'idle' | 'payment' | 'verification' | 'database' | 'complete'>('idle');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);

  // Percentage buttons for amount selection
  const percentageButtons = [
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: 'MAX', value: 100 }
  ];

  // Handle percentage button clicks
  const handlePercentageClick = (percentage: number) => {
    const percentAmount = userPPABalance * (percentage / 100);
    setAmount(percentAmount.toFixed(6));
    setSelectedPercentage(percentage);
    soundManager.playInputChange();
  };

  // Handle amount change
  const handleAmountChange = (value: string) => {
    setAmount(value);
    setSelectedPercentage(null);
  };

  // PPA token transfer function
  const transferPPATokens = async (amount: number): Promise<string | null> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      // Create connection
      const connection = new Connection('https://rpc.solana.publicnode.com', {
        commitment: 'confirmed',
      });

      const mintAddress = new PublicKey(PPA_TOKEN_ADDRESS);
      const fromWallet = publicKey;
      const toWallet = new PublicKey(PLATFORM_WALLET);

      // Get associated token addresses
      const fromTokenAccount = await getAssociatedTokenAddress(mintAddress, fromWallet);
      const toTokenAccount = await getAssociatedTokenAddress(mintAddress, toWallet);

      // Convert amount to token units (assuming 6 decimals for PPA)
      const tokenAmount = Math.floor(amount * Math.pow(10, 6));

      // Create transaction
      const transaction = new Transaction().add(
        createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromWallet,
          tokenAmount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      console.log('📝 PPA token transaction created, requesting signature...');

      // Sign transaction
      const signedTransaction = await signTransaction(transaction);

      console.log('Sending PPA token transaction to network...');

      // Send transaction
      const txid = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: true,
        maxRetries: 2,
      });

      console.log('⏳ Confirming PPA token transaction:', txid);

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(txid, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`PPA token transaction failed: ${confirmation.value.err}`);
      }

      console.log('PPA token transfer confirmed:', txid);
      return txid;

    } catch (error: any) {
      console.error('PPA token transfer error:', error);
      throw error;
    }
  };

  // Handle lock execution - 3-step process
  const handleLockPPA = async () => {
    console.log('🚀 Starting PPA lock process...');
    console.log('Wallet connected:', !!publicKey);
    console.log('Sign function available:', !!signTransaction);
    console.log('Amount:', amount);
    
    const amountNumber = parseFloat(amount);
    
    if (!amountNumber || amountNumber <= 0 || !publicKey || !signTransaction) {
      const errorMsg = !publicKey
        ? 'Wallet not connected'
        : !signTransaction
        ? 'Wallet cannot sign transactions'
        : 'No amount specified';
      setLockError(errorMsg);
      console.error('❌ Lock failed - validation error:', errorMsg);
      return;
    }

    setIsLocking(true);
    setLockError(null);
    setLockingStep('payment');
    soundManager.playInputChange();
    
    try {
      // STEP 1: Send PPA tokens to platform wallet
      console.log('🔒 STEP 1: Sending PPA tokens to platform wallet...');
      const txHash = await transferPPATokens(amountNumber);
      
      if (!txHash) {
        throw new Error('PPA token transaction failed');
      }
      
      setTransactionHash(txHash);
      setLockingStep('verification');
      
      // STEP 2: Transaction verified (already done in transferPPATokens)
      console.log('✅ STEP 2: PPA token transaction verified:', txHash);
      setLockingStep('database');
      
      // Check Supabase configuration
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Database not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
      }
      
      // STEP 3: Create lock record in database
      console.log('🔒 STEP 3: Creating PPA lock record...');
      
      const lockData = {
        wallet_address: publicKey.toString(),
        ppa_amount: amountNumber,
        lock_days: 0,
        sol_reward: 0,
        ppa_price_sol: ppaPrice,
        base_percentage: 0,
        boost_percentage: 0,
        total_percentage: 0,
        transaction_hash: txHash // Use actual PPA token transaction hash
      };
      
      console.log('Lock data prepared:', lockData);
      
      const lockRecord = await ppaLocksService.createLock(lockData);
      
      if (!lockRecord) {
        throw new Error('Failed to create lock record - database operation returned null');
      }
      
      console.log('Lock record created successfully:', lockRecord);
      setLockingStep('complete');

      if (onLockPPA) {
        onLockPPA(amountNumber, 0);
      }
      
      console.log('🎉 PPA lock completed successfully!');
      console.log(`Lock ID: ${lockRecord.id}`);
      console.log(`Amount: ${amountNumber} PPA tokens sent to platform wallet`);
      console.log(`Transaction Hash: ${txHash}`);
      
      // Close modal after 3 seconds to show success
      setTimeout(() => {
        onClose();
        setLockingStep('idle');
        setTransactionHash(null);
      }, 3000);
      
    } catch (error: any) {
      console.error('PPA lock error:', error);
      setLockError(error.message || 'Failed to lock PPA. Please try again.');
      setLockingStep('idle');
      setTransactionHash(null);
    } finally {
      setIsLocking(false);
    }
  };

  // Validation
  const isFormValid = () => {
    const amountNumber = parseFloat(amount);
    const amountValid = amount && amountNumber > 0 && amountNumber <= userPPABalance;
    const walletConnected = publicKey && signTransaction; // Need signing capability for PPA token transfer
    return amountValid && walletConnected;
  };

  const parsedAmount = parseFloat(amount) || 0;
  const dailyReward = parsedAmount * 0.01;
  const threeDayReward = parsedAmount * 0.03;
  const thirtyDayReward = parsedAmount * 0.3;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 text-white flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-gray-800 rounded-xl w-full max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-xl bg-gray-800 flex items-center justify-center">
                <Lock className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Lock PPA</h2>
                <p className="text-gray-400 text-lg">Compounding 1% PPA every 24h</p>
              </div>
            </div>
            
            <button 
              onClick={() => {
                soundManager.playModalClose();
                onClose();
              }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          {/* Available PPA Balance */}
          <div className="text-center bg-gray-900 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <Wallet className="w-5 h-5 text-gray-400 mr-2" />
              <p className="text-gray-400 text-sm">Available PPA</p>
            </div>
            <p className="text-white text-xl font-bold">{userPPABalance.toFixed(3)}</p>
          </div>

          {/* Form */}
          <div className="space-y-5">
            {/* Amount Input */}
            <div>
              <input
                type="number"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="Amount to Lock (PPA)"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400 transition-all text-center"
                step="0.01"
                max={userPPABalance}
              />
              
              {/* Percentage Buttons */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {percentageButtons.map((button) => (
                  <button
                    key={button.value}
                    onClick={() => handlePercentageClick(button.value)}
                    className={`${selectedPercentage === button.value ? 'bg-blue-400 hover:bg-blue-300' : 'bg-blue-600 hover:bg-blue-500'} text-white py-3 px-4 rounded-lg transition-all duration-200 text-sm font-bold border-2 ${selectedPercentage === button.value ? 'border-white shadow-lg' : 'border-gray-600'} hover:border-white`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Growth Preview */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center mb-3">
                <TrendingUp className="w-5 h-5 text-blue-400 mr-2" />
                <span className="text-blue-400 font-bold">Daily PPA Growth</span>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Your staked balance increases by <span className="text-blue-300 font-semibold">1% every 24 hours</span>. Rewards accrue automatically and compound while your PPA stays locked.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Daily Reward</p>
                  <p className="text-white text-lg font-bold mt-1">
                    {dailyReward > 0 ? dailyReward.toFixed(4) : '0.0000'} PPA
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">After 3 Days</p>
                  <p className="text-white text-lg font-bold mt-1">
                    {parsedAmount > 0 ? (parsedAmount + threeDayReward).toFixed(4) : '0.0000'} PPA
                  </p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">After 30 Days</p>
                  <p className="text-white text-lg font-bold mt-1">
                    {parsedAmount > 0 ? (parsedAmount + thirtyDayReward).toFixed(4) : '0.0000'} PPA
                  </p>
                </div>
              </div>
            </div>

            {/* Validation Errors */}
            {amount && parseFloat(amount) > userPPABalance && (
              <div className="bg-red-900 border border-red-700 rounded-xl p-3">
                <div className="flex items-center text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Insufficient PPA balance</span>
                </div>
              </div>
            )}

            {!publicKey && (
              <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-3">
                <div className="flex items-center text-yellow-400 text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Please connect your wallet to lock PPA</span>
                </div>
              </div>
            )}

            {lockError && (
              <div className="bg-red-900 border border-red-700 rounded-xl p-3">
                <div className="flex items-center text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>{lockError}</span>
                </div>
              </div>
            )}

            {/* Locking Progress */}
            {isLocking && (
              <div className="bg-blue-900 border border-blue-700 rounded-xl p-4">
                <div className="flex items-center mb-2">
                  <Loader2 className="w-5 h-5 text-blue-400 mr-2 animate-spin" />
                  <span className="text-blue-400 font-bold">Processing Lock...</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className={`flex items-center ${lockingStep === 'payment' ? 'text-blue-300' : lockingStep === 'verification' || lockingStep === 'database' || lockingStep === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${lockingStep === 'payment' ? 'bg-blue-400 animate-pulse' : lockingStep === 'verification' || lockingStep === 'database' || lockingStep === 'complete' ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    Step 1: Sending PPA tokens
                  </div>
                  <div className={`flex items-center ${lockingStep === 'verification' ? 'text-blue-300' : lockingStep === 'database' || lockingStep === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${lockingStep === 'verification' ? 'bg-blue-400 animate-pulse' : lockingStep === 'database' || lockingStep === 'complete' ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    Step 2: Verifying transaction
                  </div>
                  <div className={`flex items-center ${lockingStep === 'database' ? 'text-blue-300' : lockingStep === 'complete' ? 'text-green-400' : 'text-gray-500'}`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${lockingStep === 'database' ? 'bg-blue-400 animate-pulse' : lockingStep === 'complete' ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                    Step 3: Saving lock on the platform
                  </div>
                </div>
                {transactionHash && (
                  <div className="mt-3 p-2 bg-gray-800 rounded text-xs">
                    <p className="text-gray-400">Transaction:</p>
                    <p className="text-blue-300 break-all">{transactionHash}</p>
                  </div>
                )}
              </div>
            )}

            {/* Lock PPA Button */}
            <button
              onClick={handleLockPPA}
              disabled={!isFormValid() || isLocking}
              className="w-full text-black font-bold py-4 px-4 rounded-xl text-lg transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              style={{ 
                backgroundColor: !isFormValid() ? '#374151' : '#1e7cfa',
                color: !isFormValid() ? '#9ca3af' : 'black'
              }}
              onMouseEnter={(e) => {
                if (isFormValid()) {
                  (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
                }
              }}
              onMouseLeave={(e) => {
                if (isFormValid()) {
                  (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
                }
              }}
            >
              {isLocking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span className="text-white">
                    {lockingStep === 'payment' && 'Sending PPA Tokens...'}
                    {lockingStep === 'verification' && 'Verifying Transaction...'}
                    {lockingStep === 'database' && 'Creating Lock Record...'}
                    {lockingStep === 'complete' && 'Finalizing Lock...'}
                  </span>
                </>
              ) : !publicKey ? (
                <>
                  <Wallet className="w-5 h-5" />
                  <span>Connect Wallet to Lock</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Lock PPA & Start Earning</span>
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-xl">
            <p className="text-blue-300 text-xs">
              Once locked, your PPA accrues <span className="font-semibold">+1% every full day</span>. Rewards compound automatically and stay attached to your stake until you choose to unlock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 