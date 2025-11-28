#!/usr/bin/env python3
"""
Continuous liquidation watcher.

Polls every LIQUIDATION_POLL_SECONDS (default 3s), fetches all open positions from
Supabase, looks up live prices from Birdeye, and marks underwater positions as
liquidated inside the `trading_positions` table.

Environment variables required:
  SUPABASE_URL                  e.g. https://xyzcompany.supabase.co
  SUPABASE_SERVICE_ROLE_KEY     service role key with RLS bypass
  BIRDEYE_API_KEY               https://birdeye.so API key

Optional knobs:
  LIQUIDATION_POLL_SECONDS      poll cadence in seconds (default: 3)
  BIRDEYE_TIMEOUT_SECONDS       HTTP timeout for Birdeye calls (default: 8)
  BIRDEYE_CONCURRENCY           parallel Birdeye requests (default: 6)
  LOG_LEVEL                     DEBUG | INFO | WARNING | ERROR (default: INFO)
  ENV_FILE                      path to .env to load before reading env vars
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Iterable, Optional, Tuple

import aiohttp
from aiohttp import ClientSession, ClientTimeout


DEFAULT_SUPABASE_URL = "https://lgnlryhkagolllmslioy.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbmxyeWhrYWdvbGxsbXNsaW95Iiwicm9sZSI6"
    "ImFub24iLCJpYXQiOjE3NjI3OTk0MDUsImV4cCI6MjA3ODM3NTQwNX0."
    "QhUBexSa9-X8Ch86gdT7-vP-sXbpgXFYkArQTyRcNL4"
)
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbmxyeWhrYWdvbGxsbXNsaW95Iiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjc5OTQwNSwiZXhwIjoyMDc4Mzc1NDA1fQ."
    "41lXVEUH-Xws4xK-463OVGOJPAxL1_3QYA8r14poN9w"
)
DEFAULT_BIRDEYE_API_KEY = "a90c0e35649642c6b724ecc181a866ee"


SUPABASE_URL = DEFAULT_SUPABASE_URL.rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = DEFAULT_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY = DEFAULT_SUPABASE_ANON_KEY
BIRDEYE_API_KEY = DEFAULT_BIRDEYE_API_KEY

POLL_SECONDS = 3.0
BIRDEYE_TIMEOUT_SECONDS = 8.0
BIRDEYE_CONCURRENCY = 6
LOG_LEVEL = "INFO"

SUPABASE_REST_URL = f"{SUPABASE_URL}/rest/v1"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

BIRDEYE_PRICE_ENDPOINT = "https://public-api.birdeye.so/public/price"
BIRDEYE_HEADERS = {
    "X-API-KEY": BIRDEYE_API_KEY,
    "accept": "application/json",
}
SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112"


logging.basicConfig(
    level=LOG_LEVEL,
    stream=sys.stdout,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("liquidation-watcher")


def chunked(iterable: Iterable[str], size: int) -> Iterable[Tuple[str, ...]]:
    """Yield successive n-sized chunks from iterable."""
    chunk: list[str] = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) == size:
            yield tuple(chunk)
            chunk = []
    if chunk:
        yield tuple(chunk)


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_float(value: Optional[object], default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return default


class LiquidationWatcher:
    def __init__(self) -> None:
        self.stop_event = asyncio.Event()

    def request_shutdown(self) -> None:
        logger.warning("Shutdown signal received; draining in-flight tasks...")
        self.stop_event.set()

    async def run(self) -> None:
        timeout = ClientTimeout(total=BIRDEYE_TIMEOUT_SECONDS + 2)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            while not self.stop_event.is_set():
                started_at = time.monotonic()
                try:
                    await self.tick(session)
                except Exception as exc:  # pragma: no cover - best-effort logging
                    logger.exception("Tick failed: %s", exc)

                elapsed = time.monotonic() - started_at
                sleep_for = max(0.0, POLL_SECONDS - elapsed)
                try:
                    await asyncio.wait_for(self.stop_event.wait(), timeout=sleep_for)
                except asyncio.TimeoutError:
                    continue

    async def tick(self, session: ClientSession) -> None:
        positions = await self.fetch_open_positions(session)
        if not positions:
            logger.debug("No open positions to evaluate.")
            return

        sol_price = await self.fetch_price(session, SOL_TOKEN_ADDRESS)
        if sol_price is None:
            logger.warning("Skipping tick: unable to fetch SOL price.")
            return

        token_addresses = {
            pos["token_address"]
            for pos in positions
            if pos.get("token_address")
        }

        price_map = await self.fetch_token_prices(session, token_addresses)
        if not price_map:
            logger.warning("Skipping tick: no token prices resolved.")
            return

        liquidations = 0
        for position in positions:
            token_address = position.get("token_address")
            if not token_address:
                continue

            current_price = price_map.get(token_address)
            if current_price is None:
                continue

            should_liquidate, pnl_usd, margin_ratio = self.evaluate_position(
                position,
                current_price,
                sol_price,
            )

            if not should_liquidate:
                continue

            await self.mark_liquidated(
                session,
                position,
                current_price,
                pnl_usd,
                margin_ratio,
            )
            liquidations += 1

        if liquidations:
            logger.info("Liquidated %s position(s) this tick.", liquidations)
        else:
            logger.debug("All %s open positions are healthy.", len(positions))

    async def fetch_open_positions(self, session: ClientSession) -> list[dict]:
        params = {
            "select": ",".join(
                [
                    "id",
                    "wallet_address",
                    "token_address",
                    "token_symbol",
                    "direction",
                    "entry_price",
                    "liquidation_price",
                    "amount",
                    "leverage",
                    "collateral_sol",
                    "status",
                ]
            ),
            "status": "in.(open,opening)",
        }
        url = f"{SUPABASE_REST_URL}/trading_positions"
        async with session.get(url, headers=SUPABASE_HEADERS, params=params) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise RuntimeError(
                    f"Failed to fetch positions ({resp.status}): {text}"
                )
            data = await resp.json()
            return data or []

    async def fetch_token_prices(
        self,
        session: ClientSession,
        addresses: Iterable[str],
    ) -> Dict[str, float]:
        sem = asyncio.Semaphore(max(1, BIRDEYE_CONCURRENCY))

        async def fetch(address: str) -> Tuple[str, Optional[float]]:
            async with sem:
                price = await self.fetch_price(session, address)
                return address, price

        tasks = [asyncio.create_task(fetch(addr)) for addr in addresses]
        prices: Dict[str, float] = {}

        for task in asyncio.as_completed(tasks):
            address, price = await task
            if price is not None:
                prices[address] = price

        return prices

    async def fetch_price(
        self,
        session: ClientSession,
        token_address: str,
        retries: int = 3,
    ) -> Optional[float]:
        params = {"address": token_address, "chain": "solana"}
        backoff = 1.0

        for attempt in range(1, retries + 1):
            try:
                async with session.get(
                    BIRDEYE_PRICE_ENDPOINT,
                    headers=BIRDEYE_HEADERS,
                    params=params,
                ) as resp:
                    if resp.status != 200:
                        text = await resp.text()
                        raise RuntimeError(
                            f"Birdeye {resp.status} for {token_address}: {text}"
                        )
                    payload = await resp.json()
            except Exception as exc:
                logger.warning(
                    "Price fetch failed for %s (%s/%s): %s",
                    token_address,
                    attempt,
                    retries,
                    exc,
                )
            else:
                value = (
                    payload.get("data", {}).get("value")
                    if payload.get("success")
                    else None
                )
                if value is None:
                    logger.warning(
                        "Birdeye returned no price for %s: %s",
                        token_address,
                        json.dumps(payload),
                    )
                else:
                    return float(value)

            await asyncio.sleep(backoff)
            backoff *= 2

        return None

    def evaluate_position(
        self,
        position: dict,
        current_price: float,
        sol_price: float,
    ) -> Tuple[bool, float, float]:
        direction = (position.get("direction") or "Long").capitalize()
        entry_price = to_float(position.get("entry_price"))
        liquidation_price = to_float(position.get("liquidation_price"))
        amount = to_float(position.get("amount"))
        leverage = max(1.0, to_float(position.get("leverage"), 1.0))
        collateral_sol = max(0.0, to_float(position.get("collateral_sol")))

        if direction == "Long":
            pnl_usd = (current_price - entry_price) * amount * leverage
            price_triggered = current_price <= liquidation_price
        else:
            pnl_usd = (entry_price - current_price) * amount * leverage
            price_triggered = current_price >= liquidation_price

        pnl_sol = pnl_usd / sol_price if sol_price > 0 else 0.0
        margin_ratio = 0.0
        if pnl_sol < 0 and collateral_sol > 0:
            margin_ratio = min(abs(pnl_sol) / collateral_sol, 1.0)

        margin_triggered = margin_ratio >= 0.999
        should_liquidate = price_triggered or margin_triggered

        if should_liquidate:
            logger.info(
                "Position %s (%s %s) breached liquidation threshold: "
                "price %.8f vs threshold %.8f | margin_ratio=%.3f",
                position.get("id"),
                direction,
                position.get("token_symbol"),
                current_price,
                liquidation_price,
                margin_ratio,
            )

        return should_liquidate, pnl_usd, margin_ratio

    async def mark_liquidated(
        self,
        session: ClientSession,
        position: dict,
        current_price: float,
        pnl_usd: float,
        margin_ratio: float,
    ) -> None:
        payload = {
            "status": "liquidated",
            "close_price": current_price,
            "close_reason": "liquidation",
            "current_pnl": pnl_usd,
            "margin_call_triggered": True,
            "updated_at": iso_utc_now(),
            "closed_at": iso_utc_now(),
        }

        position_id = position.get("id")
        url = f"{SUPABASE_REST_URL}/trading_positions?id=eq.{position_id}"
        headers = {**SUPABASE_HEADERS, "Prefer": "return=representation"}

        async with session.patch(url, headers=headers, json=payload) as resp:
            if resp.status not in (200, 204):
                text = await resp.text()
                raise RuntimeError(
                    f"Failed to update position {position_id}: "
                    f"{resp.status} {text}"
                )

        logger.info(
            "✅ Position %s marked as liquidated at $%.8f (margin_ratio=%.3f, pnl=$%.2f)",
            position_id,
            current_price,
            margin_ratio,
            pnl_usd,
        )


async def main() -> None:
    watcher = LiquidationWatcher()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, watcher.request_shutdown)

    await watcher.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.warning("Liquidation watcher interrupted by user.")

