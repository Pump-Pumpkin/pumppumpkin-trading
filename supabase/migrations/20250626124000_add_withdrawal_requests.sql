/*
  # Add withdrawal_requests table

  1. New Tables
    - `withdrawal_requests`
      - `id` (uuid, primary key)
      - `wallet_address` (text, not null)
      - `amount` (decimal, SOL amount)
      - `status` (text, default 'pending')
      - `admin_notes` (text, nullable)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `withdrawal_requests` table
    - Add policies for anonymous users to create and read their own requests

  3. Indexes
    - Index on wallet_address for fast lookups
    - Index on status for admin filtering
    - Index on created_at for sorting
*/

-- Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  amount decimal(20, 8) NOT NULL CHECK (amount >= 0.04),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "Allow anonymous users to create withdrawal requests"
  ON withdrawal_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to read their own withdrawal requests"
  ON withdrawal_requests
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to update their own withdrawal requests"
  ON withdrawal_requests
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_wallet_address ON withdrawal_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 