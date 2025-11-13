-- Fix positions stuck in 'opening' or 'closing' status
-- Migration: 20250103000000_fix_stuck_positions.sql

-- Update all positions stuck in 'opening' status to 'open'
-- These positions were created with market orders but the delayed opening timer was lost
UPDATE trading_positions 
SET status = 'open', 
    updated_at = NOW()
WHERE status = 'opening'
  AND created_at < NOW() - INTERVAL '1 minute'; -- Only fix positions older than 1 minute

-- Update all positions stuck in 'closing' status to 'closed'
-- These positions were being closed but the delayed closing timer was lost
-- We'll close them at the current entry price since we can't get historical prices
UPDATE trading_positions 
SET status = 'closed',
    closed_at = NOW(),
    close_price = entry_price, -- Use entry price as close price (neutral P&L)
    current_pnl = 0, -- Neutral P&L since we're using entry price
    updated_at = NOW()
WHERE status = 'closing'
  AND close_initiated_at < NOW() - INTERVAL '1 minute'; -- Only fix positions older than 1 minute

-- Log the fix
DO $$
DECLARE
  opening_count INTEGER;
  closing_count INTEGER;
BEGIN
  -- Count how many positions were fixed
  SELECT COUNT(*) INTO opening_count 
  FROM trading_positions 
  WHERE status = 'open' 
    AND updated_at >= NOW() - INTERVAL '1 second'
    AND created_at < NOW() - INTERVAL '1 minute';
    
  SELECT COUNT(*) INTO closing_count
  FROM trading_positions 
  WHERE status = 'closed' 
    AND updated_at >= NOW() - INTERVAL '1 second'
    AND close_initiated_at < NOW() - INTERVAL '1 minute';
  
  RAISE NOTICE 'Fixed % positions stuck in opening status', opening_count;
  RAISE NOTICE 'Fixed % positions stuck in closing status', closing_count;
  RAISE NOTICE 'Delayed opening/closing mechanism has been removed - positions now open/close immediately';
END $$; 