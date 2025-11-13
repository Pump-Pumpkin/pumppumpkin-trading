-- Create trading_positions table for leveraged trading
CREATE TABLE IF NOT EXISTS trading_positions (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('Long', 'Short')),
  order_type TEXT NOT NULL CHECK (order_type IN ('Market Order', 'Limit Order')),
  entry_price DECIMAL(20, 10) NOT NULL,
  target_price DECIMAL(20, 10),
  amount DECIMAL(20, 10) NOT NULL,
  leverage INTEGER NOT NULL CHECK (leverage >= 2 AND leverage <= 100),
  collateral_sol DECIMAL(20, 10) NOT NULL,
  position_value_usd DECIMAL(20, 2) NOT NULL,
  -- REMOVED: Trading fee fields no longer needed
  -- trading_fee_usd DECIMAL(20, 2),
  -- trading_fee_sol DECIMAL(20, 10),
  -- trading_fee_percentage DECIMAL(10, 6),
  stop_loss DECIMAL(20, 10),
  take_profit DECIMAL(20, 10),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'open', 'closed', 'liquidated', 'cancelled')),
  current_pnl DECIMAL(20, 2) DEFAULT 0,
  liquidation_price DECIMAL(20, 10) NOT NULL,
  margin_call_triggered BOOLEAN DEFAULT FALSE,
  margin_call_price DECIMAL(20, 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  close_price DECIMAL(20, 10),
  close_reason TEXT,
  trade_results TEXT -- JSON string containing detailed trade results for frontend
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trading_positions_wallet_address ON trading_positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trading_positions_status ON trading_positions(status);
CREATE INDEX IF NOT EXISTS idx_trading_positions_token_address ON trading_positions(token_address);
CREATE INDEX IF NOT EXISTS idx_trading_positions_created_at ON trading_positions(created_at);

-- Create position_updates table for tracking P&L changes
CREATE TABLE IF NOT EXISTS position_updates (
  id SERIAL PRIMARY KEY,
  position_id INTEGER NOT NULL REFERENCES trading_positions(id) ON DELETE CASCADE,
  price DECIMAL(20, 10) NOT NULL,
  pnl DECIMAL(20, 2) NOT NULL,
  margin_ratio DECIMAL(5, 4) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for position updates
CREATE INDEX IF NOT EXISTS idx_position_updates_position_id ON position_updates(position_id);
CREATE INDEX IF NOT EXISTS idx_position_updates_created_at ON position_updates(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE trading_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for trading_positions
CREATE POLICY "Users can view their own positions" ON trading_positions
    FOR SELECT USING (true); -- Allow all users to read (for admin purposes)

CREATE POLICY "Users can insert their own positions" ON trading_positions
    FOR INSERT WITH CHECK (true); -- Allow all users to insert

CREATE POLICY "Users can update their own positions" ON trading_positions
    FOR UPDATE USING (true); -- Allow all users to update (for admin purposes)

CREATE POLICY "Users can delete their own positions" ON trading_positions
    FOR DELETE USING (true); -- Allow all users to delete (for admin purposes)

-- Create RLS policies for position_updates
CREATE POLICY "Users can view position updates" ON position_updates
    FOR SELECT USING (true); -- Allow all users to read

CREATE POLICY "Users can insert position updates" ON position_updates
    FOR INSERT WITH CHECK (true); -- Allow all users to insert

CREATE POLICY "Users can update position updates" ON position_updates
    FOR UPDATE USING (true); -- Allow all users to update

CREATE POLICY "Users can delete position updates" ON position_updates
    FOR DELETE USING (true); -- Allow all users to delete 