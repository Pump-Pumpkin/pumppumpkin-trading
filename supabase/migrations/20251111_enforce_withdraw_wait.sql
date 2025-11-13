/*
  Enforce: Users must wait 3 months from their last deposit to create a withdrawal request.
  - Replaces the permissive INSERT policy on withdrawal_requests with a guarded one.
*/

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS deposit_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive INSERT policy (if any)
DROP POLICY IF EXISTS "Allow anonymous users to create withdrawal requests" ON withdrawal_requests;

-- Create guarded INSERT policy:
-- Allow INSERT only if the user's most recent deposit is at least 3 months old.
-- If the user has no deposits, allow (treat as older than 3 months).
CREATE POLICY "Create withdrawal after 3 months from last deposit"
  ON withdrawal_requests
  FOR INSERT
  TO anon
  WITH CHECK (
    COALESCE(
      (
        SELECT MAX(d.created_at) < now() - interval '3 months'
        FROM deposit_transactions d
        WHERE d.wallet_address = withdrawal_requests.wallet_address
      ),
      true
    )
  );


