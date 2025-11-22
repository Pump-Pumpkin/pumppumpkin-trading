-- Add columns to support daily PPA compounding
ALTER TABLE IF EXISTS public.ppa_locks
  ADD COLUMN IF NOT EXISTS accrued_ppa numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_accrued_at timestamptz;

-- Backfill last_accrued_at for existing rows
UPDATE public.ppa_locks
SET last_accrued_at = COALESCE(last_accrued_at, locked_at)
WHERE last_accrued_at IS NULL;

-- Ensure accrued_ppa is never null
UPDATE public.ppa_locks
SET accrued_ppa = 0
WHERE accrued_ppa IS NULL;

-- Create helper function to sync accrued rewards
CREATE OR REPLACE FUNCTION public.update_ppa_accrual(p_wallet text)
RETURNS SETOF public.ppa_locks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
BEGIN
  WITH calc AS (
    SELECT
      id,
      ppa_amount,
      COALESCE(accrued_ppa, 0) AS accrued_ppa,
      COALESCE(last_accrued_at, locked_at) AS last_time,
      GREATEST(
        FLOOR(EXTRACT(epoch FROM (now() - COALESCE(last_accrued_at, locked_at))) / 86400),
        0
      )::integer AS days
    FROM public.ppa_locks
    WHERE wallet_address = p_wallet
      AND status = 'active'
  ), updated AS (
    UPDATE public.ppa_locks pl
    SET accrued_ppa = pl.accrued_ppa + ((pl.ppa_amount + pl.accrued_ppa) * (POWER(1.01, calc.days) - 1)),
        last_accrued_at = COALESCE(pl.last_accrued_at, pl.locked_at) + (calc.days * INTERVAL '1 day'),
        updated_at = NOW()
    FROM calc
    WHERE pl.id = calc.id
      AND calc.days >= 1
    RETURNING pl.*
  )
  SELECT NULL;

  RETURN QUERY
  SELECT *
  FROM public.ppa_locks
  WHERE wallet_address = p_wallet;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_ppa_accrual(text) TO anon, authenticated;
