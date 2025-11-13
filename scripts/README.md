Run the deposit verifier (server-side)

1) Create a Python venv and install deps:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements.txt
```

2) Set required environment variables (use your server/DO droplet; never expose service key to the browser):

```bash
export SUPABASE_URL=https://<your-project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
export SOLANA_RPC_URL=https://<your-solana-rpc>
export PLATFORM_WALLET=CTDZ5teoWajqVcAsWQyEmmvHQzaDiV1jrnvwRmcL1iWv
# Optional
export VERIFY_WINDOW_MINUTES=60
export VERIFY_BATCH_LIMIT=100
```

3) Run:

```bash
python scripts/verify_deposits.py
```

How it works
- Pulls recent rows from `deposit_transactions`.
- For each unverified row, searches Solana for a SystemProgram transfer from `wallet_address` to `PLATFORM_WALLET` within ± VERIFY_WINDOW_MINUTES of `created_at`, for the expected amount.
- On match, sets `txid` and `is_verified=true`, then credits `user_profiles.sol_balance += amount`.

Safety
- `txid` has a unique index; a transaction cannot be double-applied.
- Keep RLS locked; this script uses the service role key.

Cron example

```bash
*/2 * * * * cd /path/to/repo && . .venv/bin/activate && SOLANA_RPC_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... PLATFORM_WALLET=... python scripts/verify_deposits.py >> /var/log/verify_deposits.log 2>&1
```


