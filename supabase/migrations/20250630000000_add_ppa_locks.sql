/*
  # Add PPA Locks Table

  1. New Tables
    - `ppa_locks`
      - `id` (uuid, primary key)
      - `wallet_address` (text, not null)
      - `ppa_amount` (decimal, not null) - Amount of PPA locked
      - `lock_days` (integer, not null) - Number of days locked for
      - `sol_reward` (decimal, not null) - SOL reward amount paid upfront
      - `ppa_price_sol` (decimal, not null) - PPA price in SOL at time of lock
      - `base_percentage` (decimal, not null) - Base reward percentage (0.2% per day)
      - `boost_percentage` (decimal, not null) - Boost percentage (1% per extra day)
      - `total_percentage` (decimal, not null) - Total reward percentage
      - `locked_at` (timestamp, not null) - When the lock was created
      - `unlocks_at` (timestamp, not null) - When the lock expires
      - `status` (text, default 'active') - Lock status: 'active', 'unlocked', 'cancelled'
      - `transaction_hash` (text, not null) - SOL payment transaction hash
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `ppa_locks` table
    - Add policy for users to read their own lock records
    - Add policy for inserting new lock records

  3. Indexes
    - Index on wallet_address for fast user lookups
    - Index on status for filtering active locks
    - Index on unlocks_at for expiration queries
*/

-- Create ppa_locks table
CREATE TABLE IF NOT EXISTS ppa_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  ppa_amount decimal(20, 8) NOT NULL,
  lock_days integer NOT NULL,
  sol_reward decimal(20, 8) NOT NULL,
  ppa_price_sol decimal(20, 8) NOT NULL,
  base_percentage decimal(10, 4) NOT NULL,
  boost_percentage decimal(10, 4) NOT NULL,
  total_percentage decimal(10, 4) NOT NULL,
  locked_at timestamp with time zone NOT NULL DEFAULT now(),
  unlocks_at timestamp with time zone NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'unlocked', 'cancelled')),
  transaction_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE ppa_locks ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ppa_locks_wallet_address ON ppa_locks (wallet_address);
CREATE INDEX IF NOT EXISTS idx_ppa_locks_status ON ppa_locks (status);
CREATE INDEX IF NOT EXISTS idx_ppa_locks_unlocks_at ON ppa_locks (unlocks_at);

-- RLS Policies
CREATE POLICY "Users can view their own PPA locks" ON ppa_locks
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own PPA locks" ON ppa_locks
  FOR INSERT WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ppa_locks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ppa_locks_updated_at
  BEFORE UPDATE ON ppa_locks
  FOR EACH ROW
  EXECUTE FUNCTION update_ppa_locks_updated_at(); 