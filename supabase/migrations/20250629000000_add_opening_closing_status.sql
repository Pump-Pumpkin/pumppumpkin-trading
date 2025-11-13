-- Add support for 1-minute delayed opening and closing with worst-price selection (anti-gaming)
-- Migration: 20250629000000_add_opening_closing_status.sql

-- Add 'opening' and 'closing' status to existing CHECK constraint
ALTER TABLE trading_positions 
DROP CONSTRAINT IF EXISTS trading_positions_status_check;

ALTER TABLE trading_positions 
ADD CONSTRAINT trading_positions_status_check 
CHECK (status IN ('pending', 'opening', 'open', 'closing', 'closed', 'liquidated', 'cancelled'));

-- Add close_initiated_at column to track when closing was initiated
ALTER TABLE trading_positions 
ADD COLUMN IF NOT EXISTS close_initiated_at TIMESTAMP;

-- Add comment explaining the anti-gaming system
COMMENT ON COLUMN trading_positions.close_initiated_at IS 
'Timestamp when position close was initiated. Used for 1-minute delayed closing with worst-price selection to prevent gaming.';

COMMENT ON CONSTRAINT trading_positions_status_check ON trading_positions IS 
'Status constraint including opening and closing states for 1-minute delayed execution system that prevents price gaming.'; 