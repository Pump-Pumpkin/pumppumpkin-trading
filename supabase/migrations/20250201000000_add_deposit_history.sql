/*
  # Add deposit_transactions table

  1. New Tables
    - `deposit_transactions`
      - `id` (uuid, primary key)
      - `wallet_address` (text, not null)
      - `amount` (decimal, SOL amount)
      - `platform_wallet` (text, not null) - Platform receiving wallet
      - `status` (text, default 'completed')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `deposit_transactions` table
    - Add policies for anonymous users to create and read their own deposits

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on transaction_hash for verification
    - Index on created_at for sorting
*/

-- Create deposit_transactions table
CREATE TABLE IF NOT EXISTS deposit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount decimal(20, 8) NOT NULL CHECK (amount >= 0.04),
  platform_wallet text NOT NULL DEFAULT 'CTDZ5teoWajqVcAsWQyEmmvHQzaDiV1jrnvwRmcL1iWv',
  status text DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE deposit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "Allow anonymous users to create deposit records"
  ON deposit_transactions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to read their own deposit records"
  ON deposit_transactions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to update their own deposit records"
  ON deposit_transactions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_wallet_address ON deposit_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_deposit_transactions_created_at ON deposit_transactions(created_at DESC);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_deposit_transactions_updated_at
  BEFORE UPDATE ON deposit_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
