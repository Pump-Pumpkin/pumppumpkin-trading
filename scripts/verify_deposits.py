#!/usr/bin/env python3
import os
import sys
import time
import math
import json
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from supabase import create_client, Client


def env_required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        print(f"Missing required env var: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def lamports(amount_sol: float) -> int:
    return int(round(amount_sol * 1_000_000_000))


def parse_iso8601(ts: str) -> datetime:
    # Supabase timestamptz returns ISO strings; ensure tz-aware
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class SolanaRPC:
    def __init__(self, rpc_url: str):
        self.rpc_url = rpc_url

    def _post(self, method: str, params):
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        }
        r = requests.post(self.rpc_url, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        if "error" in data:
            raise RuntimeError(f"RPC error {data['error']}")
        return data["result"]

    def get_signatures_for_address(self, address: str, limit: int = 1000, before: str | None = None, until: str | None = None):
        params = [address, {"limit": limit}]
        if before:
            params[1]["before"] = before
        if until:
            params[1]["until"] = until
        return self._post("getSignaturesForAddress", params)

    def get_transaction(self, signature: str):
        # jsonParsed gives readable instruction data
        return self._post("getTransaction", [signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}])


def find_matching_transfer(rpc: SolanaRPC, platform_wallet: str, user_wallet: str, expected_sol: float, created_at: datetime, window_minutes: int = 60) -> str | None:
    """
    Search recent txns involving the platform wallet around created_at,
    and return the signature of a SystemProgram transfer from user -> platform
    with the expected amount (within 0.000001 SOL).
    """
    start = created_at - timedelta(minutes=window_minutes)
    end = created_at + timedelta(minutes=window_minutes)

    # Strategy: get signatures for the platform wallet, then fetch tx details and match
    # Note: We could paginate if needed; start with last N signatures
    signatures = rpc.get_signatures_for_address(platform_wallet, limit=1000)
    if not signatures:
        return None

    expected_lamports = lamports(expected_sol)
    tolerance_lamports = lamports(0.000001)  # tolerance of 0.000001 SOL

    for sig_entry in signatures:
        sig = sig_entry.get("signature")
        block_time = sig_entry.get("blockTime")
        if not sig or not block_time:
            continue
        block_dt = datetime.fromtimestamp(block_time, tz=timezone.utc)
        if block_dt < start or block_dt > end:
            continue

        tx = rpc.get_transaction(sig)
        if not tx:
            continue
        meta = (tx or {}).get("meta") or {}
        transaction = (tx or {}).get("transaction") or {}
        message = transaction.get("message") or {}
        acct_keys = [k.get("pubkey") if isinstance(k, dict) else k for k in (message.get("accountKeys") or [])]
        if not acct_keys or user_wallet not in acct_keys or platform_wallet not in acct_keys:
            continue

        # Inspect parsed instructions for a SystemProgram transfer
        for inst in (message.get("instructions") or []):
            program = inst.get("program")
            parsed = inst.get("parsed") or {}
            if program != "system" or parsed.get("type") != "transfer":
                continue
            info = parsed.get("info") or {}
            source = info.get("source")
            destination = info.get("destination")
            lamports_sent = info.get("lamports")
            if source == user_wallet and destination == platform_wallet and isinstance(lamports_sent, int):
                if abs(lamports_sent - expected_lamports) <= tolerance_lamports:
                    return sig
    return None


def main():
    load_dotenv()

    supabase_url = env_required("SUPABASE_URL")
    supabase_service_key = env_required("SUPABASE_SERVICE_ROLE_KEY")
    solana_rpc_url = env_required("SOLANA_RPC_URL")
    platform_wallet = env_required("PLATFORM_WALLET")

    window_minutes = int(os.getenv("VERIFY_WINDOW_MINUTES", "60"))
    batch_limit = int(os.getenv("VERIFY_BATCH_LIMIT", "100"))

    rpc = SolanaRPC(solana_rpc_url)
    supabase: Client = create_client(supabase_url, supabase_service_key)

    # Fetch deposits that need verification: either is_verified = false OR txid is null
    # Limit batch size for each run
    res = supabase.table("deposit_transactions") \
        .select("id,wallet_address,amount,created_at,txid,is_verified") \
        .order("created_at", desc=True) \
        .limit(batch_limit) \
        .execute()

    rows = res.data or []
    if not rows:
        print("No deposits to inspect.")
        return

    verified = 0
    updated_balances = 0
    for row in rows:
        txid = row.get("txid")
        is_verified = row.get("is_verified", False)
        if is_verified and txid:
            continue  # already verified

        wallet_address = row["wallet_address"]
        amount = float(row["amount"])
        created_at = parse_iso8601(row["created_at"])

        print(f"Checking deposit id={row['id']} wallet={wallet_address} amount={amount} created_at={created_at.isoformat()} ...")

        try:
            sig = find_matching_transfer(
                rpc=rpc,
                platform_wallet=platform_wallet,
                user_wallet=wallet_address,
                expected_sol=amount,
                created_at=created_at,
                window_minutes=window_minutes,
            )
        except Exception as e:
            print(f"  RPC error while searching transactions: {e}")
            continue

        if not sig:
            print("  No matching on-chain transfer found (yet).")
            continue

        print(f"  Matched on-chain tx: {sig}")

        # Update the deposit row with txid and is_verified = true
        supabase.table("deposit_transactions") \
            .update({"txid": sig, "is_verified": True}) \
            .eq("id", row["id"]) \
            .execute()
        verified += 1

        # Credit user's platform balance atomically by adding amount
        # We do a read then write. For stronger safety, this should be a Postgres function or use row-level lock.
        profile_res = supabase.table("user_profiles") \
            .select("wallet_address,sol_balance") \
            .eq("wallet_address", wallet_address) \
            .single() \
            .execute()
        prof = profile_res.data
        current_sol = float(prof["sol_balance"]) if prof and prof.get("sol_balance") is not None else 0.0
        new_sol = current_sol + amount
        supabase.table("user_profiles") \
            .update({"sol_balance": new_sol, "updated_at": datetime.now(timezone.utc).isoformat()}) \
            .eq("wallet_address", wallet_address) \
            .execute()
        updated_balances += 1
        print(f"  Credited platform balance: {current_sol:.9f} -> {new_sol:.9f} SOL")

    print(f"Done. verified={verified}, balances_updated={updated_balances}")


if __name__ == "__main__":
    main()


