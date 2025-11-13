import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

// Create Supabase client with anonymous access
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We don't need session persistence for anonymous access
    autoRefreshToken: false,
  },
});

// Database types
export interface UserProfile {
  id: string;
  wallet_address: string;
  username: string;
  profile_image?: string;
  balance: number;
  sol_balance: number; // Add SOL balance tracking
  created_at: string;
  updated_at: string;
}

export interface CreateUserProfileData {
  wallet_address: string;
  username: string;
  profile_image?: string;
  balance?: number;
  sol_balance?: number; // Add SOL balance to creation data
}

export interface UpdateUserProfileData {
  username?: string;
  profile_image?: string;
  balance?: number;
  sol_balance?: number; // Add SOL balance to update data
}

export interface WithdrawalRequest {
  id: string;
  wallet_address: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWithdrawalRequestData {
  wallet_address: string;
  amount: number;
}

export interface DepositTransaction {
  id: string;
  wallet_address: string;
  amount: number;
  platform_wallet: string;
  status: 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface CreateDepositTransactionData {
  wallet_address: string;
  amount: number;
}

// User profile service
export class UserProfileService {
  /**
   * Set the current wallet address for RLS policies
   */
  private async setCurrentWalletAddress(walletAddress: string) {
    await supabase.rpc('set_config', {
      setting_name: 'app.current_wallet_address',
      setting_value: walletAddress,
      is_local: true
    });
  }

  /**
   * Create a new user profile
   */
  async createProfile(data: CreateUserProfileData): Promise<UserProfile | null> {
    try {
      console.log('🔄 Creating user profile:', data.wallet_address);
      
      await this.setCurrentWalletAddress(data.wallet_address);
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .insert([{
          wallet_address: data.wallet_address,
          username: data.username,
          profile_image: data.profile_image,
          balance: data.balance || 0,
          sol_balance: data.sol_balance || 0, // Initialize SOL balance
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating profile:', error);
        return null;
      }

      console.log('✅ Profile created successfully:', profile.wallet_address);
      return profile;
    } catch (error) {
      console.error('💥 Error in createProfile:', error);
      return null;
    }
  }

  /**
   * Get user profile by wallet address
   */
  async getProfile(walletAddress: string): Promise<UserProfile | null> {
    try {
      console.log('🔍 Fetching profile for:', walletAddress);
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('📝 No profile found for wallet:', walletAddress);
          return null;
        }
        console.error('❌ Error fetching profile:', error);
        return null;
      }

      console.log('✅ Profile found:', profile.username);
      return profile;
    } catch (error) {
      console.error('💥 Error in getProfile:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    walletAddress: string, 
    updates: UpdateUserProfileData
  ): Promise<UserProfile | null> {
    try {
      console.log('🔄 Updating profile for:', walletAddress);
      
      await this.setCurrentWalletAddress(walletAddress);
      
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('wallet_address', walletAddress)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating profile:', error);
        return null;
      }

      console.log('✅ Profile updated successfully');
      return profile;
    } catch (error) {
      console.error('💥 Error in updateProfile:', error);
      return null;
    }
  }

  /**
   * Update user balance (USD trading balance)
   */
  async updateBalance(walletAddress: string, newBalance: number): Promise<boolean> {
    try {
      console.log('💰 Updating USD balance for:', walletAddress, 'to:', newBalance);
      
      await this.setCurrentWalletAddress(walletAddress);
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ balance: newBalance })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('❌ Error updating balance:', error);
        return false;
      }

      console.log('✅ USD balance updated successfully');
      return true;
    } catch (error) {
      console.error('💥 Error in updateBalance:', error);
      return false;
    }
  }

  /**
   * Update user SOL balance (simplified after fixing RLS policy)
   */
  async updateSOLBalance(walletAddress: string, newSOLBalance: number): Promise<boolean> {
    try {
      console.log('💰 Updating SOL balance for:', walletAddress, 'to:', newSOLBalance);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          sol_balance: newSOLBalance,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .select('id, wallet_address, sol_balance');

      if (updateError) {
        console.error('❌ SOL Balance Update FAILED:', updateError);
        return false;
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('❌ UPDATE QUERY MATCHED ZERO ROWS!');
        return false;
      }
      
      console.log('✅ SOL balance updated successfully');
      console.log('📊 New SOL balance in DB:', updateResult[0].sol_balance);
      return true;
      
    } catch (error: any) {
      console.error('💥 Error in updateSOLBalance:', error);
      return false;
    }
  }

  /**
   * Credit SOL sharing reward to user's balance (5% of collateral)
   */
  async creditSharingReward(walletAddress: string, rewardAmount: number): Promise<boolean> {
    try {
      console.log(`🎁 Crediting sharing reward (${rewardAmount} SOL) to:`, walletAddress);
      
      await this.setCurrentWalletAddress(walletAddress);
      
      // Get current profile to calculate new balance
      const profile = await this.getProfile(walletAddress);
      if (!profile) {
        console.error('❌ Profile not found for sharing reward');
        return false;
      }
      
      const newSOLBalance = profile.sol_balance + rewardAmount;
      
      const { data: updateResult, error: updateError } = await supabase
        .from('user_profiles')
        .update({ 
          sol_balance: newSOLBalance,
          updated_at: new Date().toISOString()
        })
        .eq('wallet_address', walletAddress)
        .select('id, wallet_address, sol_balance');

      if (updateError) {
        console.error('❌ Sharing reward credit FAILED:', updateError);
        return false;
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('❌ SHARING REWARD UPDATE MATCHED ZERO ROWS!');
        return false;
      }
      
      console.log('✅ Sharing reward credited successfully');
      console.log(`📊 SOL balance: ${profile.sol_balance} → ${newSOLBalance} (+${rewardAmount})`);
      return true;
      
    } catch (error: any) {
      console.error('💥 Error crediting sharing reward:', error);
      return false;
    }
  }

  /**
   * Update both USD and SOL balances
   */
  async updateBalances(
    walletAddress: string, 
    newBalance: number, 
    newSOLBalance: number
  ): Promise<boolean> {
    try {
      console.log('💰 Updating both balances for:', walletAddress);
      
      await this.setCurrentWalletAddress(walletAddress);
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          balance: newBalance,
          sol_balance: newSOLBalance 
        })
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('❌ Error updating balances:', error);
        return false;
      }

      console.log('✅ Both balances updated successfully');
      return true;
    } catch (error) {
      console.error('💥 Error in updateBalances:', error);
      return false;
    }
  }

  /**
   * Check if profile exists
   */
  async profileExists(walletAddress: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('wallet_address', walletAddress)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all profiles (for admin/debugging)
   */
  async getAllProfiles(): Promise<UserProfile[]> {
    try {
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching all profiles:', error);
        return [];
      }

      return profiles || [];
    } catch (error) {
      console.error('💥 Error in getAllProfiles:', error);
      return [];
    }
  }

  /**
   * Create a withdrawal request and deduct SOL balance immediately
   */
  async createWithdrawalRequest(
    walletAddress: string, 
    amount: number
  ): Promise<WithdrawalRequest | null> {
    try {
      console.log('💸 Creating withdrawal request for:', walletAddress, 'amount:', amount);
      
      // First, get current SOL balance
      const profile = await this.getProfile(walletAddress);
      if (!profile) {
        console.error('❌ Profile not found for withdrawal request');
        return null;
      }

      // Check for locked collateral in active positions
      const { data: activePositions } = await supabase
        .from('trading_positions')
        .select('collateral_sol')
        .eq('wallet_address', walletAddress)
        .in('status', ['pending', 'opening', 'open', 'closing']);

      const lockedCollateral = activePositions?.reduce((total, pos) => total + (pos.collateral_sol || 0), 0) || 0;
      const availableBalance = profile.sol_balance - lockedCollateral;

      console.log('💰 Withdrawal validation:', {
        totalBalance: profile.sol_balance,
        lockedCollateral,
        availableBalance,
        requestedAmount: amount
      });

      if (availableBalance < amount) {
        console.error('❌ Insufficient available balance for withdrawal request');
        console.error(`Available: ${availableBalance.toFixed(4)} SOL, Requested: ${amount.toFixed(4)} SOL`);
        return null;
      }

      // Create the withdrawal request
      const { data: withdrawalRequest, error: requestError } = await supabase
        .from('withdrawal_requests')
        .insert([{
          wallet_address: walletAddress,
          amount: amount,
          status: 'pending'
        }])
        .select()
        .single();

      if (requestError) {
        console.error('❌ Error creating withdrawal request:', requestError);
        return null;
      }

      // Deduct the amount from user's SOL balance immediately
      const newSOLBalance = profile.sol_balance - amount;
      const balanceUpdated = await this.updateSOLBalance(walletAddress, newSOLBalance);
      
      if (!balanceUpdated) {
        console.error('❌ Failed to update SOL balance after withdrawal request');
        // TODO: In production, we might want to delete the withdrawal request if balance update fails
        return null;
      }

      console.log('✅ Withdrawal request created and balance deducted');
      console.log(`📊 SOL balance: ${profile.sol_balance} → ${newSOLBalance}`);
      
      return withdrawalRequest;
    } catch (error) {
      console.error('💥 Error in createWithdrawalRequest:', error);
      return null;
    }
  }

  /**
   * Get withdrawal requests for a user
   */
  async getWithdrawalRequests(walletAddress: string): Promise<WithdrawalRequest[]> {
    try {
      console.log('📋 Fetching withdrawal requests for:', walletAddress);
      
      const { data: requests, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching withdrawal requests:', error);
        return [];
      }

      console.log(`✅ Found ${requests?.length || 0} withdrawal requests`);
      return requests || [];
    } catch (error) {
      console.error('💥 Error in getWithdrawalRequests:', error);
      return [];
    }
  }

  /**
   * Check if user has pending withdrawal requests
   */
  async hasPendingWithdrawalRequest(walletAddress: string): Promise<boolean> {
    try {
      const { data: requests, error } = await supabase
        .from('withdrawal_requests')
        .select('id')
        .eq('wallet_address', walletAddress)
        .eq('status', 'pending')
        .limit(1);

      if (error) {
        console.error('❌ Error checking pending withdrawal requests:', error);
        return false;
      }

      return (requests?.length || 0) > 0;
    } catch (error) {
      console.error('💥 Error in hasPendingWithdrawalRequest:', error);
      return false;
    }
  }

  /**
   * Create a deposit transaction record after successful blockchain transfer
   */
  async createDepositRecord(
    walletAddress: string,
    amount: number
  ): Promise<DepositTransaction | null> {
    try {
      console.log('💰 Creating deposit record for:', walletAddress, 'amount:', amount);
      
      const { data: depositRecord, error: recordError } = await supabase
        .from('deposit_transactions')
        .insert([{
          wallet_address: walletAddress,
          amount: amount,
          status: 'completed'
        }])
        .select()
        .single();

      if (recordError) {
        console.error('❌ Error creating deposit record:', recordError);
        return null;
      }

      console.log('✅ Deposit record created successfully:', depositRecord.id);
      return depositRecord;
    } catch (error) {
      console.error('💥 Error in createDepositRecord:', error);
      return null;
    }
  }

  /**
   * Get deposit history for a user
   */
  async getDepositHistory(walletAddress: string): Promise<DepositTransaction[]> {
    try {
      console.log('📋 Fetching deposit history for:', walletAddress);
      
      const { data: deposits, error } = await supabase
        .from('deposit_transactions')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching deposit history:', error);
        return [];
      }

      console.log(`✅ Found ${deposits?.length || 0} deposit transactions`);
      return deposits || [];
    } catch (error) {
      console.error('💥 Error in getDepositHistory:', error);
      return [];
    }
  }

  /**
   * Get total deposited amount for a user
   */
  async getTotalDeposits(walletAddress: string): Promise<number> {
    try {
      const { data: deposits, error } = await supabase
        .from('deposit_transactions')
        .select('amount')
        .eq('wallet_address', walletAddress)
        .eq('status', 'completed');

      if (error) {
        console.error('❌ Error calculating total deposits:', error);
        return 0;
      }

      const total = deposits?.reduce((sum, deposit) => sum + Number(deposit.amount), 0) || 0;
      console.log(`💰 Total deposits for ${walletAddress}: ${total.toFixed(4)} SOL`);
      return total;
    } catch (error) {
      console.error('💥 Error in getTotalDeposits:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const userProfileService = new UserProfileService();

// PPA Lock interface
export interface PPALock {
  id: string;
  wallet_address: string;
  ppa_amount: number;
  lock_days: number;
  sol_reward: number;
  ppa_price_sol: number;
  base_percentage: number;
  boost_percentage: number;
  total_percentage: number;
  locked_at: string;
  unlocks_at: string;
  status: 'active' | 'unlocked' | 'cancelled';
  transaction_hash: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePPALockData {
  wallet_address: string;
  ppa_amount: number;
  lock_days: number;
  sol_reward: number;
  ppa_price_sol: number;
  base_percentage: number;
  boost_percentage: number;
  total_percentage: number;
  transaction_hash: string;
}

export interface PPAUnlockRequest {
  id: string;
  wallet_address: string;
  lock_id: string;
  ppa_amount: number;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  processed_at?: string;
  transaction_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePPAUnlockRequestData {
  wallet_address: string;
  lock_id: string;
  ppa_amount: number;
}

// PPA locks service
export class PPALocksService {
  /**
   * Create a new PPA lock record
   */
  async createLock(data: CreatePPALockData): Promise<PPALock | null> {
    try {
      console.log('🔒 Creating PPA lock record:', data.wallet_address);
      
      // Calculate unlock date
      const lockedAt = new Date();
      const unlocksAt = new Date(lockedAt.getTime() + (data.lock_days * 24 * 60 * 60 * 1000));
      
      const { data: lock, error } = await supabase
        .from('ppa_locks')
        .insert([{
          wallet_address: data.wallet_address,
          ppa_amount: data.ppa_amount,
          lock_days: data.lock_days,
          sol_reward: data.sol_reward,
          ppa_price_sol: data.ppa_price_sol,
          base_percentage: data.base_percentage,
          boost_percentage: data.boost_percentage,
          total_percentage: data.total_percentage,
          locked_at: lockedAt.toISOString(),
          unlocks_at: unlocksAt.toISOString(),
          transaction_hash: data.transaction_hash,
          status: 'active'
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating PPA lock:', error);
        return null;
      }

      console.log('✅ PPA lock created successfully:', lock.id);
      return lock;
    } catch (error) {
      console.error('💥 Error in createLock:', error);
      return null;
    }
  }

  /**
   * Get PPA locks for a wallet address
   */
  async getLocksByWallet(walletAddress: string): Promise<PPALock[]> {
    try {
      console.log('🔍 Fetching PPA locks for:', walletAddress);
      
      const { data: locks, error } = await supabase
        .from('ppa_locks')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching PPA locks:', error);
        return [];
      }

      return locks || [];
    } catch (error) {
      console.error('💥 Error in getLocksByWallet:', error);
      return [];
    }
  }

  /**
   * Get active PPA locks for a wallet address
   */
  async getActiveLocksByWallet(walletAddress: string): Promise<PPALock[]> {
    try {
      const { data: locks, error } = await supabase
        .from('ppa_locks')
        .select('*')
        .eq('wallet_address', walletAddress)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching active PPA locks:', error);
        return [];
      }

      return locks || [];
    } catch (error) {
      console.error('💥 Error in getActiveLocksByWallet:', error);
      return [];
    }
  }

  /**
   * Calculate lifetime SOL earnings from PPA locks for a wallet
   */
  async getLifetimeEarnings(walletAddress: string): Promise<number> {
    try {
      console.log('💰 Calculating lifetime PPA lock earnings for:', walletAddress);
      
      const { data: locks, error } = await supabase
        .from('ppa_locks')
        .select('sol_reward')
        .eq('wallet_address', walletAddress);

      if (error) {
        console.error('❌ Error fetching PPA lock earnings:', error);
        return 0;
      }

      if (!locks || locks.length === 0) {
        return 0;
      }

      // Sum all SOL rewards from all locks
      const totalSOLEarned = locks.reduce((total, lock) => total + (lock.sol_reward || 0), 0);
      
      console.log(`✅ Lifetime PPA lock earnings: ${totalSOLEarned} SOL`);
      return totalSOLEarned;
    } catch (error) {
      console.error('💥 Error in getLifetimeEarnings:', error);
      return 0;
    }
  }

  /**
   * Create an unlock request for an expired PPA lock
   */
  async createUnlockRequest(data: CreatePPAUnlockRequestData): Promise<PPAUnlockRequest | null> {
    try {
      console.log('🔓 Creating PPA unlock request:', data.lock_id);
      
      const { data: unlockRequest, error } = await supabase
        .from('ppa_unlock_requests')
        .insert([{
          wallet_address: data.wallet_address,
          lock_id: data.lock_id,
          ppa_amount: data.ppa_amount,
          requested_at: new Date().toISOString(),
          status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating unlock request:', error);
        return null;
      }

      console.log('✅ Unlock request created successfully:', unlockRequest.id);
      return unlockRequest;
    } catch (error) {
      console.error('💥 Error in createUnlockRequest:', error);
      return null;
    }
  }

  /**
   * Get unlock requests for a wallet address
   */
  async getUnlockRequestsByWallet(walletAddress: string): Promise<PPAUnlockRequest[]> {
    try {
      console.log('🔍 Fetching unlock requests for:', walletAddress);
      
      const { data: requests, error } = await supabase
        .from('ppa_unlock_requests')
        .select('*')
        .eq('wallet_address', walletAddress)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching unlock requests:', error);
        return [];
      }

      return requests || [];
    } catch (error) {
      console.error('💥 Error in getUnlockRequestsByWallet:', error);
      return [];
    }
  }
}

export const ppaLocksService = new PPALocksService();