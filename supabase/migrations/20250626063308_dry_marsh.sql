/*
  # Create User Profiles Table

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key)
      - `wallet_address` (text, unique, not null)
      - `username` (text, not null)
      - `profile_image` (text, nullable)
      - `balance` (decimal, default 0)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `user_profiles` table
    - Add policy for users to read/write their own profile data
    - Add policy for anonymous users to create profiles

  3. Indexes
    - Unique index on wallet_address for fast lookups
    - Index on created_at for sorting
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text UNIQUE NOT NULL,
  username text NOT NULL,
  profile_image text,
  balance decimal(20, 8) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "Allow anonymous users to create profiles"
  ON user_profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anonymous users to read all profiles"
  ON user_profiles
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anonymous users to update their own profile"
  ON user_profiles
  FOR UPDATE
  TO anon
  USING (wallet_address = current_setting('app.current_wallet_address', true))
  WITH CHECK (wallet_address = current_setting('app.current_wallet_address', true));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet_address ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();