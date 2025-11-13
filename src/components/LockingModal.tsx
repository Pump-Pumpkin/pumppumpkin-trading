import React, { useState, useEffect } from 'react';
import { X, Lock, Wallet, Calculator, AlertTriangle, Loader2 } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import { soundManager } from '../services/soundManager';
import { ppaLocksService, userProfileService } from '../services/supabaseClient';

interface LockingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPPABalance: number;
  ppaPrice: number; // PPA price in SOL
  onLockPPA?: (amount: number, lockPeriod: number) => void;
  onUpdateSOLBalance?: (newBalance: number) => void; // Callback to update SOL balance
}

// Platform wallet address for receiving PPA tokens
const PLATFORM_WALLET = 'CTDZ5teoWajqVcAsWQyEmmvHQzaDiV1jrnvwRmcL1iWv';
// PPA token address
const PPA_TOKEN_ADDRESS = '51NRTtZ8GwG3J4MGmxTsGJAdLViwu9s5ggEQup35pump';

export default function LockingModal({ isOpen, onClose, userPPABalance, ppaPrice, onLockPPA, onUpdateSOLBalance }: LockingModalProps) {
  const { publicKey, signTransaction } = useWallet();
  const [amount, setAmount] = useState('');
  const [lockDays, setLockDays] = useState<number>(7); // Default to minimum 7 days
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

  // Calculate upfront SOL reward (0.2% per day + boost for extra days)
  const calculateUpfrontReward = () => {
    if (!amount || !ppaPrice) return null;
    
    const lockAmount = parseFloat(amount);
    // Convert PPA amount to SOL value first
    const ppaValueInSOL = lockAmount * ppaPrice;
    
    // Base reward: 0.2% per day of PPA value in SOL
    const baseRewardPercentage = lockDays * 0.2; // 0.2% per day
    
    // Boost: 1% additional for every day above 7
    const extraDays = Math.max(0, lockDays - 7);
    const boostPercentage = extraDays * 1.0; // 1% per extra day
    
    // Total reward percentage
    const totalRewardPercentage = baseRewardPercentage + boostPercentage;
    const upfrontSOLReward = ppaValueInSOL * (totalRewardPercentage / 100);
    
    return {
      percentage: totalRewardPercentage,
      basePercentage: baseRewardPercentage,
      boostPercentage: boostPercentage,
      solAmount: upfrontSOLReward,
      days: lockDays,
      extraDays: extraDays
    };
  };

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
      const connection = new Connection('https://dimensional-white-pine.solana-mainnet.quiknode.pro/e229761b955e887d87f412414b4024c993e7a91d/', {
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
    console.log('Upfront reward:', upfrontReward);
    
    if (!amount || !publicKey || !signTransaction) {
      const errorMsg = !publicKey ? 'Wallet not connected' : !signTransaction ? 'Wallet cannot sign transactions' : 'No amount specified';
      setLockError(errorMsg);
      console.error('❌ Lock failed - validation error:', errorMsg);
      return;
    }

    if (!upfrontReward) {
      setLockError('Cannot calculate reward');
      console.error('❌ Lock failed - cannot calculate reward');
      return;
    }

    setIsLocking(true);
    setLockError(null);
    setLockingStep('payment');
    soundManager.playInputChange();
    
    try {
      // STEP 1: Send PPA tokens to platform wallet
      console.log('🔒 STEP 1: Sending PPA tokens to platform wallet...');
      const txHash = await transferPPATokens(parseFloat(amount));
      
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
        ppa_amount: parseFloat(amount),
        lock_days: lockDays,
        sol_reward: upfrontReward.solAmount,
        ppa_price_sol: ppaPrice,
        base_percentage: upfrontReward.basePercentage,
        boost_percentage: upfrontReward.boostPercentage,
        total_percentage: upfrontReward.percentage,
        transaction_hash: txHash // Use actual PPA token transaction hash
      };
      
      console.log('Lock data prepared:', lockData);
      
      const lockRecord = await ppaLocksService.createLock(lockData);
      
      if (!lockRecord) {
        throw new Error('Failed to create lock record - database operation returned null');
      }
      
      console.log('Lock record created successfully:', lockRecord);
      
      // STEP 3: Credit SOL balance immediately
      console.log('🔒 STEP 3: Crediting SOL reward to platform balance...');
      setLockingStep('complete');
      
      if (onUpdateSOLBalance) {
        // Get current user profile to update SOL balance
        const userProfile = await userProfileService.getProfile(publicKey.toString());
        if (userProfile) {
          const newSOLBalance = userProfile.sol_balance + upfrontReward.solAmount;
          
          // Update user's SOL balance in database
          await userProfileService.updateProfile(publicKey.toString(), {
            sol_balance: newSOLBalance
          });
          
          // Update UI
          onUpdateSOLBalance(newSOLBalance);
          
          console.log(`✅ SOL balance credited: +${upfrontReward.solAmount.toFixed(4)} SOL`);
        }
      }
      
      console.log('🎉 PPA lock completed successfully!');
      console.log(`Lock ID: ${lockRecord.id}`);
      console.log(`Amount: ${amount} PPA tokens sent to platform wallet`);
      console.log(`Lock Duration: ${lockDays} days`);
      console.log(`Transaction Hash: ${txHash}`);
      console.log(`SOL Reward: ${upfrontReward.solAmount.toFixed(4)} SOL credited to platform balance`);
      
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
    const amountValid = amount && parseFloat(amount) > 0 && parseFloat(amount) <= userPPABalance;
    const daysValid = lockDays >= 7 && lockDays <= 30;
    const walletConnected = publicKey && signTransaction; // Need signing capability for PPA token transfer
    return amountValid && daysValid && walletConnected;
  };

  const upfrontReward = calculateUpfrontReward();

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
                <p className="text-gray-400 text-lg">Earn SOL Rewards</p>
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

            {/* Lock Period Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-400 text-lg">Lock Period</span>
                <span className="text-white text-2xl font-bold">{lockDays} days</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min="7"
                  max="30"
                  value={lockDays}
                  onChange={(e) => {
                    setLockDays(parseInt(e.target.value));
                    soundManager.playInputChange();
                  }}
                  className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2 text-center">
                  <span>7 days<br/><span className="text-xs">1.4%</span></span>
                  <span>15 days<br/><span className="text-xs text-blue-400">11%</span></span>
                  <span>30 days<br/><span className="text-xs text-blue-400">29%</span></span>
                </div>
              </div>
            </div>

            {/* Upfront Reward Preview */}
            {upfrontReward && (
              <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div className="flex items-center mb-3">
                  <Calculator className="w-5 h-5 text-blue-400 mr-2" />
                  <span className="text-blue-400 font-bold">Immediate SOL Reward</span>
                </div>
                
                {/* Main reward display */}
                <div className="grid grid-cols-2 gap-4 text-center mb-3">
                  <div>
                    <p className="text-white text-lg font-bold">{upfrontReward.percentage.toFixed(1)}%</p>
                    <p className="text-gray-400 text-xs">Total Reward</p>
                  </div>
                  <div>
                    <p className="text-white text-lg font-bold">{upfrontReward.solAmount.toFixed(4)} SOL</p>
                    <p className="text-gray-400 text-xs">Instant Payment</p>
                  </div>
                </div>

                {/* Reward breakdown if there's a boost */}
                {upfrontReward.extraDays > 0 && (
                  <div className="border-t border-gray-700 pt-3 mb-3">
                    <p className="text-gray-400 text-xs text-center mb-2">Reward Breakdown:</p>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-gray-300 text-sm">{upfrontReward.basePercentage.toFixed(1)}%</p>
                        <p className="text-gray-500 text-xs">Base (0.2%/day)</p>
                      </div>
                      <div>
                        <p className="text-blue-300 text-sm">+{upfrontReward.boostPercentage.toFixed(1)}%</p>
                        <p className="text-blue-400 text-xs">Boost ({upfrontReward.extraDays} extra days)</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="text-center">
                  <p className="text-gray-400 text-xs">
                    You receive this SOL immediately when you lock your PPA
                  </p>
                  {upfrontReward.extraDays > 0 && (
                    <p className="text-blue-400 text-xs mt-1">
                      Extra {upfrontReward.extraDays} days = +{upfrontReward.boostPercentage}% bonus!
                    </p>
                  )}
                </div>
              </div>
            )}

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
                    Step 3: Creating lock & crediting SOL
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
                    {lockingStep === 'complete' && 'Crediting SOL Reward!'}
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
                  <span>Lock PPA & Earn SOL</span>
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-900 border border-blue-700 rounded-xl">
            <p className="text-blue-300 text-xs">
              Send your PPA tokens to our platform wallet to lock them for {lockDays} days and receive instant SOL rewards credited to your platform balance. Base: 0.2% per day + 1% bonus for each day above 7.
            </p>
          </div>

          {/* Custom Styles for Slider */}
          <style>{`
            .slider::-webkit-slider-thumb {
              appearance: none;
              height: 16px;
              width: 16px;
              border-radius: 50%;
              background: #1e7cfa;
              cursor: pointer;
              border: 2px solid #ffffff;
            }
            
            .slider::-moz-range-thumb {
              height: 16px;
              width: 16px;
              border-radius: 50%;
              background: #1e7cfa;
              cursor: pointer;
              border: 2px solid #ffffff;
            }
          `}</style>
        </div>
      </div>
    </div>
  );
} 