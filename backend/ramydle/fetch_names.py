"""Replace the price feed's truncated names with the catalogue's full ones.

The price transparency file caps ItemName at 20 characters, so ~73% of products
arrive clipped mid-word ("משקה סויה וניל על הב"). Rami Levy's own catalogue API
answers unauthenticated and carries the real name ("משקה סויה וניל על הבוקר 1
ליטר"), so we look each barcode up once and cache the answer.

The catalogue covers the online store, which is a subset of the physical-store
price file — barcodes it does not know keep their truncated name.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

import httpx

from .fetch_images import Throttle

DATA = Path(__file__).resolve().parent.parent / "data"
POOL = DATA / "pool.json"
NAMES = DATA / "names.json"

API = "https://www.rami-levy.co.il/api/catalog"
# The name is the same catalogue-wide; the store only affects price, which we ignore.
STORE = "331"
CONCURRENCY = 2
MAX_RETRIES = 6


async def lookup_all(barcodes: list[str], cache: dict[str, str | None]) -> dict[str, str | None]:
    todo = [b for b in barcodes if b not in cache]
    print(f"{len(barcodes) - len(todo)} cached, querying {len(todo)}")
    if not todo:
        return cache

    sem = asyncio.Semaphore(CONCURRENCY)
    throttle = Throttle()
    done = 0

    headers = {"content-type": "application/json", "accept": "application/json", "locale": "he"}
    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:

        async def lookup(barcode: str) -> None:
            nonlocal done
            async with sem:
                for _ in range(MAX_RETRIES):
                    await throttle.wait()
                    try:
                        resp = await client.post(
                            API, json={"q": barcode, "store": STORE, "aggs": 0}
                        )
                    except httpx.HTTPError:
                        await throttle.back_off(None)
                        continue
                    if resp.status_code == 429:
                        await throttle.back_off(resp.headers.get("retry-after"))
                        continue
                    throttle.ok()
                    if resp.status_code == 200:
                        try:
                            rows = resp.json().get("data") or []
                        except ValueError:
                            rows = []
                        # None records "asked, catalogue does not have it" so we never re-ask.
                        cache[barcode] = (rows[0].get("name") or "").strip() or None if rows else None
                    break
            done += 1
            if done % 200 == 0:
                found = sum(1 for v in cache.values() if v)
                print(f"  {done}/{len(todo)} ({found} names found so far)")

        await asyncio.gather(*(lookup(b) for b in todo))

    return cache


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="query only the first N products")
    args = parser.parse_args()

    if not POOL.exists():
        print(f"missing {POOL} — run build_pool.py first", file=sys.stderr)
        return 1

    pool = json.loads(POOL.read_text())
    barcodes = [i["barcode"] for i in pool["items"]]
    if args.limit:
        barcodes = barcodes[: args.limit]

    cache = json.loads(NAMES.read_text()) if NAMES.exists() else {}
    try:
        cache = asyncio.run(lookup_all(barcodes, cache))
    finally:
        NAMES.write_text(json.dumps(cache, ensure_ascii=False, indent=1))

    improved = 0
    for item in pool["items"]:
        full = cache.get(item["barcode"])
        if full and full != item["name"]:
            item["name"] = full
            improved += 1

    POOL.write_text(json.dumps(pool, ensure_ascii=False, indent=1))

    known = sum(1 for b in barcodes if cache.get(b))
    print(f"catalogue knew {known}/{len(barcodes)} barcodes ({known * 100 // max(len(barcodes), 1)}%)")
    print(f"replaced {improved} truncated names in {POOL.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
