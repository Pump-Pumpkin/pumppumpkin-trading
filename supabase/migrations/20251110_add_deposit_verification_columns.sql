/*
  Add verification metadata to deposit_transactions:
   - txid: on-chain transaction id (unique when present)
   - is_verified: whether we have verified this deposit on-chain
*/

ALTER TABLE IF EXISTS deposit_transactions
  ADD COLUMN IF NOT EXISTS txid text,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Prevent double-credit by ensuring unique txids once populated
CREATE UNIQUE INDEX IF NOT EXISTS uniq_deposit_txid
  ON deposit_transactions(txid) WHERE txid IS NOT NULL;


