/*
  # Atlos deposit flow

  1. New Tables
    - `atlos_deposit_orders`
      - Track widget initiated deposits and allow webhook reconciliation.

  2. Existing Tables
    - `deposit_transactions`
      - Add metadata columns for Atlos deposits.
      - Allow pending rows (amount can be NULL until settled).
*/

-- Create Atlos deposit order tracking table
CREATE TABLE IF NOT EXISTS public.atlos_deposit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE,
  wallet_address text NOT NULL,
  requested_usd numeric(20, 8) NOT NULL CHECK (requested_usd >= 20),
  asset_symbol text DEFAULT 'USDC',
  payment_id text,
  transaction_id text,
  tx_hash text,
  paid_usd numeric(20, 8),
  paid_asset_amount numeric(20, 8),
  paid_asset_symbol text,
  credited_sol numeric(20, 8),
  routed_wallet text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_settlement', 'completed', 'failed', 'expired')),
  verification_source text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atlos_deposit_orders_wallet
  ON public.atlos_deposit_orders (wallet_address);

-- Enable RLS so clients can poll their own order state if needed
ALTER TABLE public.atlos_deposit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Allow anon users to read their Atlos orders"
  ON public.atlos_deposit_orders
  FOR SELECT
  TO anon
  USING (
    wallet_address = current_setting('app.current_wallet_address', true)
  );

CREATE TRIGGER update_atlos_deposit_orders_updated_at
  BEFORE UPDATE ON public.atlos_deposit_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Extend deposit_transactions with Atlos metadata
ALTER TABLE public.deposit_transactions
  ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE public.deposit_transactions
  DROP CONSTRAINT IF EXISTS deposit_transactions_amount_check;

ALTER TABLE public.deposit_transactions
  ADD CONSTRAINT deposit_transactions_amount_check
  CHECK (amount IS NULL OR amount >= 0.04);

ALTER TABLE public.deposit_transactions
  DROP CONSTRAINT IF EXISTS deposit_transactions_status_check;

ALTER TABLE public.deposit_transactions
  ADD CONSTRAINT deposit_transactions_status_check
  CHECK (status IN ('pending', 'completed', 'failed'));

ALTER TABLE public.deposit_transactions
  ADD COLUMN IF NOT EXISTS order_id text,
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS asset_symbol text DEFAULT 'SOL',
  ADD COLUMN IF NOT EXISTS fiat_amount_usd numeric(20, 8),
  ADD COLUMN IF NOT EXISTS txid text,
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_transactions_order_id
  ON public.deposit_transactions(order_id)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_transactions_txid
  ON public.deposit_transactions(txid)
  WHERE txid IS NOT NULL;


