/*
  Tighten RLS to prevent client-side faked deposits or balance updates.
  - Removes anon UPDATE on user_profiles
  - Removes anon INSERT/UPDATE on deposit_transactions
  - Keeps anon SELECT on deposits restricted to current wallet address
*/

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deposit_transactions ENABLE ROW LEVEL SECURITY;

-- 1) Stop anonymous users from updating profiles (balances)
DROP POLICY IF EXISTS "Allow anonymous users to update profiles" ON user_profiles;

-- Optionally replace with a stricter policy (read-only for anon updates)
-- If you need limited updates later, do it via a service role in an Edge/Serverless function.

-- 2) Stop anonymous users from inserting/updating deposit records
DROP POLICY IF EXISTS "Allow anonymous users to create deposit records" ON deposit_transactions;
DROP POLICY IF EXISTS "Allow anonymous users to update their own deposit records" ON deposit_transactions;

-- 3) Restrict anonymous SELECT on deposits to the currently set wallet only
DROP POLICY IF EXISTS "Allow anonymous users to read their own deposit records" ON deposit_transactions;
CREATE POLICY "Anon can read deposit records for current wallet"
  ON deposit_transactions
  FOR SELECT
  TO anon
  USING (wallet_address = current_setting('app.current_wallet_address', true));

-- Note:
-- Frontend must call a secure backend (service role) to:
--  - Verify on-chain transfer
--  - Insert deposit_transactions
--  - Update user_profiles.sol_balance
-- The client should NOT write these tables directly with the anon key.