/*
  # Add SOL Balance Tracking

  1. Schema Changes
    - Add `sol_balance` column to `user_profiles` table
    - Add index for performance

  2. Security
    - Update existing RLS policies to include new column
    - Maintain existing security model

  3. Data Migration
    - Set default SOL balance to 0 for existing users
*/

-- Add sol_balance column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sol_balance'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sol_balance decimal(20, 8) DEFAULT 0;
  END IF;
END $$;

-- Create index for SOL balance queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_sol_balance ON user_profiles(sol_balance);

-- Update existing records to have 0 SOL balance if null
UPDATE user_profiles SET sol_balance = 0 WHERE sol_balance IS NULL;