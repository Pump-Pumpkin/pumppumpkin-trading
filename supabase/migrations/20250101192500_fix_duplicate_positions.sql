-- Migration: Fix existing duplicate positions and add comprehensive duplicate protection
-- This prevents users from accidentally creating duplicate positions

-- STEP 1: Clean up existing duplicate positions before adding constraints
-- Close older duplicate active positions, keeping only the newest one per wallet/token/direction

DO $$
DECLARE
  cleanup_count INTEGER;
BEGIN
  RAISE NOTICE 'Starting cleanup of existing duplicate positions...';
  
  WITH duplicate_positions AS (
    SELECT 
      id,
      wallet_address,
      token_address,
      direction,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY wallet_address, token_address, direction 
        ORDER BY created_at DESC
      ) as position_rank
    FROM trading_positions 
    WHERE status IN ('pending', 'opening', 'open')
  ),
  positions_to_close AS (
    SELECT id 
    FROM duplicate_positions 
    WHERE position_rank > 1
  )
  UPDATE trading_positions 
  SET 
    status = 'closed',
    close_reason = 'duplicate_cleanup',
    closed_at = NOW(),
    updated_at = NOW()
  WHERE id IN (SELECT id FROM positions_to_close);
  
  GET DIAGNOSTICS cleanup_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % duplicate positions before adding unique constraint', cleanup_count;
END $$;

-- STEP 2: Add unique constraint to prevent duplicate active positions
-- Users can only have one active position per token per direction
DO $$
BEGIN
  RAISE NOTICE 'Adding unique constraint to prevent future duplicates...';
  
  ALTER TABLE trading_positions 
  ADD CONSTRAINT unique_active_position_per_token 
  UNIQUE (wallet_address, token_address, direction)
  DEFERRABLE INITIALLY DEFERRED;
  
  RAISE NOTICE 'Unique constraint added successfully';
EXCEPTION
  WHEN duplicate_table THEN
    RAISE NOTICE 'Unique constraint already exists, skipping...';
END $$;

-- STEP 3: Add request deduplication tracking table
CREATE TABLE IF NOT EXISTS position_creation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 seconds')
);

-- Index for fast request deduplication lookups
CREATE INDEX IF NOT EXISTS idx_position_requests_hash ON position_creation_requests(request_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_position_requests_expires ON position_creation_requests(expires_at);

-- Auto-cleanup expired requests
CREATE OR REPLACE FUNCTION cleanup_expired_requests()
RETURNS void AS $$
BEGIN
  DELETE FROM position_creation_requests WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- STEP 4: Create atomic position creation function with balance locking
CREATE OR REPLACE FUNCTION create_position_atomic(
  p_wallet_address TEXT,
  p_token_address TEXT,
  p_token_symbol TEXT,
  p_direction TEXT,
  p_order_type TEXT,
  p_entry_price DECIMAL(20, 10),
  p_target_price DECIMAL(20, 10),
  p_amount DECIMAL(20, 10),
  p_leverage INTEGER,
  p_collateral_sol DECIMAL(20, 10),
  p_position_value_usd DECIMAL(20, 2),
  p_stop_loss DECIMAL(20, 10),
  p_take_profit DECIMAL(20, 10),
  p_liquidation_price DECIMAL(20, 10),
  p_margin_call_price DECIMAL(20, 10),
  p_request_hash TEXT
)
RETURNS JSON AS $$
DECLARE
  v_current_balance DECIMAL(20, 10);
  v_new_balance DECIMAL(20, 10);
  v_position_id INTEGER;
  v_existing_request_count INTEGER;
  v_existing_position_count INTEGER;
  v_result JSON;
BEGIN
  -- Check for duplicate request (within 30 seconds)
  SELECT COUNT(*) INTO v_existing_request_count
  FROM position_creation_requests 
  WHERE request_hash = p_request_hash 
    AND expires_at > NOW();
  
  IF v_existing_request_count > 0 THEN
    RAISE EXCEPTION 'Duplicate request detected. Please wait before retrying.';
  END IF;

  -- Check for existing active position for same wallet/token/direction
  SELECT COUNT(*) INTO v_existing_position_count
  FROM trading_positions
  WHERE wallet_address = p_wallet_address
    AND token_address = p_token_address
    AND direction = p_direction
    AND status IN ('pending', 'opening', 'open');
  
  IF v_existing_position_count > 0 THEN
    RAISE EXCEPTION 'You already have an active position for this token in the same direction. Please close existing position first.';
  END IF;

  -- Insert request tracking record
  INSERT INTO position_creation_requests (wallet_address, request_hash)
  VALUES (p_wallet_address, p_request_hash);

  -- Lock user balance for update (prevents race conditions)
  SELECT sol_balance INTO v_current_balance
  FROM user_profiles 
  WHERE wallet_address = p_wallet_address
  FOR UPDATE;
  
  -- Check if user has sufficient balance
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found for wallet: %', p_wallet_address;
  END IF;
  
  IF v_current_balance < p_collateral_sol THEN
    RAISE EXCEPTION 'Insufficient SOL balance. Need % SOL but only have % SOL', 
      p_collateral_sol, v_current_balance;
  END IF;
  
  -- Calculate new balance
  v_new_balance := v_current_balance - p_collateral_sol;
  
  -- Create position
  INSERT INTO trading_positions (
    wallet_address,
    token_address,
    token_symbol,
    direction,
    order_type,
    entry_price,
    target_price,
    amount,
    leverage,
    collateral_sol,
    position_value_usd,
    stop_loss,
    take_profit,
    status,
    liquidation_price,
    margin_call_price
  ) VALUES (
    p_wallet_address,
    p_token_address,
    p_token_symbol,
    p_direction,
    p_order_type,
    p_entry_price,
    p_target_price,
    p_amount,
    p_leverage,
    p_collateral_sol,
    p_position_value_usd,
    p_stop_loss,
    p_take_profit,
    CASE WHEN p_order_type = 'Market Order' THEN 'open' ELSE 'pending' END,
    p_liquidation_price,
    p_margin_call_price
  ) RETURNING id INTO v_position_id;
  
  -- Update user balance atomically
  UPDATE user_profiles 
  SET sol_balance = v_new_balance,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address;
  
  -- Return success result
  SELECT json_build_object(
    'success', true,
    'position_id', v_position_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'collateral_deducted', p_collateral_sol
  ) INTO v_result;
  
  RETURN v_result;
  
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an active position for this token in the same direction. Please close existing position first.';
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- STEP 5: Create cleanup job for expired requests (optional, for maintenance)
CREATE OR REPLACE FUNCTION schedule_cleanup_expired_requests()
RETURNS void AS $$
BEGIN
  -- This would typically be called by a cron job
  PERFORM cleanup_expired_requests();
END;
$$ LANGUAGE plpgsql;

-- STEP 6: Add comments explaining the protection system
COMMENT ON CONSTRAINT unique_active_position_per_token ON trading_positions IS 
'Prevents users from creating multiple active positions for the same token in the same direction, avoiding accidental balance overdrafts';

COMMENT ON TABLE position_creation_requests IS 
'Tracks position creation requests to prevent duplicate submissions within 30 seconds';

COMMENT ON FUNCTION create_position_atomic IS 
'Atomically creates a trading position and updates user balance with pessimistic locking to prevent race conditions';

-- STEP 7: Log completion
DO $$
BEGIN
  RAISE NOTICE '=== DUPLICATE PROTECTION MIGRATION COMPLETED ===';
  RAISE NOTICE 'Added unique constraint: unique_active_position_per_token';
  RAISE NOTICE 'Created atomic function: create_position_atomic';
  RAISE NOTICE 'Created request tracking table: position_creation_requests';
  RAISE NOTICE 'Platform is now protected against duplicate position creation';
END $$; 