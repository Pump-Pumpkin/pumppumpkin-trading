-- Add trade_results column to store trade results for frontend display
ALTER TABLE trading_positions 
ADD COLUMN trade_results TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN trading_positions.trade_results IS 'JSON string containing trade results for frontend display after position closes'; 