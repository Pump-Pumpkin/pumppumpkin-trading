/*
  Create enhanced atomic trading function with fee handling.

  Summary:
    - Adds trading fee tracking columns to trading_positions
    - Creates create_position_atomic_with_fees function with SECURITY DEFINER
      so it can safely update balances despite tighter RLS policies
*/

-- Ensure trading_positions has columns required for fee tracking
ALTER TABLE IF EXISTS trading_positions
  ADD COLUMN IF NOT EXISTS trading_fee_sol DECIMAL(20, 10) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trading_fee_usd DECIMAL(20, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trading_fee_percentage DECIMAL(10, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_required_sol DECIMAL(20, 10) DEFAULT 0;

-- Backfill new columns for existing rows
UPDATE trading_positions
SET
  trading_fee_sol = COALESCE(trading_fee_sol, 0),
  trading_fee_usd = COALESCE(trading_fee_usd, 0),
  trading_fee_percentage = COALESCE(trading_fee_percentage, 0),
  total_required_sol = CASE
    WHEN total_required_sol IS NULL OR total_required_sol = 0
    THEN collateral_sol
    ELSE total_required_sol
  END;

-- Drop previous version of the function if it exists (signature must match)
DROP FUNCTION IF EXISTS public.create_position_atomic_with_fees(
  p_wallet_address TEXT,
  p_token_address TEXT,
  p_token_symbol TEXT,
  p_direction TEXT,
  p_order_type TEXT,
  p_entry_price DECIMAL,
  p_target_price DECIMAL,
  p_amount DECIMAL,
  p_leverage INTEGER,
  p_collateral_sol DECIMAL,
  p_trading_fee_sol DECIMAL,
  p_trading_fee_usd DECIMAL,
  p_trading_fee_percentage DECIMAL,
  p_total_required_sol DECIMAL,
  p_position_value_usd DECIMAL,
  p_stop_loss DECIMAL,
  p_take_profit DECIMAL,
  p_liquidation_price DECIMAL,
  p_margin_call_price DECIMAL,
  p_request_hash TEXT
);

CREATE OR REPLACE FUNCTION public.create_position_atomic_with_fees(
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
  p_trading_fee_sol DECIMAL(20, 10),
  p_trading_fee_usd DECIMAL(20, 2),
  p_trading_fee_percentage DECIMAL(10, 6),
  p_total_required_sol DECIMAL(20, 10),
  p_position_value_usd DECIMAL(20, 2),
  p_stop_loss DECIMAL(20, 10),
  p_take_profit DECIMAL(20, 10),
  p_liquidation_price DECIMAL(20, 10),
  p_margin_call_price DECIMAL(20, 10),
  p_request_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_request_count INTEGER;
  v_existing_position_count INTEGER;
  v_current_balance DECIMAL(20, 10);
  v_new_balance DECIMAL(20, 10);
  v_position_id INTEGER;
  v_collateral_required DECIMAL(20, 10) := GREATEST(p_collateral_sol, 0);
  v_fee_required DECIMAL(20, 10) := GREATEST(COALESCE(p_trading_fee_sol, 0), 0);
  v_total_required DECIMAL(20, 10);
  v_result JSON;
BEGIN
  -- Clean up any expired request hashes to keep table tidy
  PERFORM cleanup_expired_requests();

  -- Calculate total SOL required for the trade
  v_total_required := COALESCE(p_total_required_sol, v_collateral_required + v_fee_required);

  IF v_total_required <= 0 THEN
    RAISE EXCEPTION 'Total required SOL must be greater than zero';
  END IF;

  -- Prevent duplicate submissions within the debounce window
  SELECT COUNT(*)
  INTO v_existing_request_count
  FROM position_creation_requests
  WHERE request_hash = p_request_hash
    AND expires_at > NOW();

  IF v_existing_request_count > 0 THEN
    RAISE EXCEPTION 'Duplicate request detected. Please wait before retrying.';
  END IF;

  -- Ensure user does not already have an active position for this token/direction
  SELECT COUNT(*)
  INTO v_existing_position_count
  FROM trading_positions
  WHERE wallet_address = p_wallet_address
    AND token_address = p_token_address
    AND direction = p_direction
    AND status IN ('pending', 'opening', 'open');

  IF v_existing_position_count > 0 THEN
    RAISE EXCEPTION 'You already have an active position for this token in the same direction. Please close existing position first.';
  END IF;

  -- Track this request so duplicates are blocked during the 30-second window
  INSERT INTO position_creation_requests (wallet_address, request_hash)
  VALUES (p_wallet_address, p_request_hash);

  -- Lock the user row while we verify and deduct balance
  SELECT sol_balance
  INTO v_current_balance
  FROM user_profiles
  WHERE wallet_address = p_wallet_address
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'User profile not found for wallet: %', p_wallet_address;
  END IF;

  IF v_current_balance < v_total_required THEN
    RAISE EXCEPTION 'Insufficient SOL balance. Need % SOL but only have % SOL',
      v_total_required, v_current_balance;
  END IF;

  -- Deduct the total required amount
  v_new_balance := v_current_balance - v_total_required;

  -- Create the trading position record
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
    trading_fee_sol,
    trading_fee_usd,
    trading_fee_percentage,
    total_required_sol,
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
    v_collateral_required,
    p_position_value_usd,
    v_fee_required,
    COALESCE(p_trading_fee_usd, 0),
    COALESCE(p_trading_fee_percentage, 0),
    v_total_required,
    p_stop_loss,
    p_take_profit,
    CASE
      WHEN p_order_type = 'Market Order' THEN 'open'
      ELSE 'pending'
    END,
    p_liquidation_price,
    p_margin_call_price
  )
  RETURNING id INTO v_position_id;

  -- Persist the new SOL balance atomically
  UPDATE user_profiles
  SET
    sol_balance = v_new_balance,
    updated_at = NOW()
  WHERE wallet_address = p_wallet_address;

  SELECT json_build_object(
    'success', true,
    'position_id', v_position_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'collateral_deducted', v_collateral_required,
    'trading_fee_deducted', v_fee_required,
    'total_deducted', v_total_required
  )
  INTO v_result;

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an active position for this token in the same direction. Please close existing position first.';
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_position_atomic_with_fees(
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
  p_trading_fee_sol DECIMAL(20, 10),
  p_trading_fee_usd DECIMAL(20, 2),
  p_trading_fee_percentage DECIMAL(10, 6),
  p_total_required_sol DECIMAL(20, 10),
  p_position_value_usd DECIMAL(20, 2),
  p_stop_loss DECIMAL(20, 10),
  p_take_profit DECIMAL(20, 10),
  p_liquidation_price DECIMAL(20, 10),
  p_margin_call_price DECIMAL(20, 10),
  p_request_hash TEXT
) TO anon;

COMMENT ON FUNCTION public.create_position_atomic_with_fees(
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
  p_trading_fee_sol DECIMAL(20, 10),
  p_trading_fee_usd DECIMAL(20, 2),
  p_trading_fee_percentage DECIMAL(10, 6),
  p_total_required_sol DECIMAL(20, 10),
  p_position_value_usd DECIMAL(20, 2),
  p_stop_loss DECIMAL(20, 10),
  p_take_profit DECIMAL(20, 10),
  p_liquidation_price DECIMAL(20, 10),
  p_margin_call_price DECIMAL(20, 10),
  p_request_hash TEXT
) IS
'Atomically creates a trading position, records trading fees, and updates user SOL balance with pessimistic locking';


