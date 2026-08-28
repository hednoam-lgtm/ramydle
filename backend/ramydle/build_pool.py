"""Turn a PriceFull XML into the curated pool of guessable products.

Only products with a real photo on Rami Levy's image CDN make the cut: the price
file covers every item in a physical store, which is a superset of the online
catalogue that has images.
"""

import argparse
import asyncio
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx

DATA = Path(__file__).resolve().parent.parent / "data"
RAW = DATA / "raw"
IMAGE_CACHE = DATA / "image_cache.json"
# The pool is served as a static asset, so it lives in the frontend and is committed.
POOL = Path(__file__).resolve().parents[2] / "frontend" / "public" / "pool.json"

IMG = "https://img.rami-levy.co.il/product/{barcode}/{size}.jpg"
MIN_PRICE, MAX_PRICE = 2.0, 200.0
CONCURRENCY = 6
UNKNOWN = "לא ידוע"


def newest_pricefull() -> Path:
    files = sorted(RAW.glob("PriceFull*.xml"))
    if not files:
        raise SystemExit("no PriceFull XML in data/raw — run fetch_prices.py first")
    return files[-1]


def _text(item: ET.Element, tag: str) -> str:
    node = item.find(tag)
    return (node.text or "").strip() if node is not None else ""


def package_size(quantity: str, unit: str) -> str:
    """UnitOfMeasure is the unit-pricing basis ('100 גרם'), not the package unit."""
    unit = re.sub(r"^100\s+", "", unit).strip()
    if not unit or unit == UNKNOWN:
        return ""
    try:
        amount = float(quantity)
    except ValueError:
        return ""
    if amount <= 0:
        return ""
    return f"{amount:g} {unit}"


def parse_items(path: Path) -> list[dict]:
    root = ET.parse(path).getroot()
    seen: set[str] = set()
    out = []
    for item in root.findall(".//Item"):
        barcode = _text(item, "ItemCode")
        # both name fields are truncated by the feed (20 and 25 chars); take whichever survived better
        name = max(
            _text(item, "ItemName"),
            _text(item, "ManufactureItemDescription"),
            key=len,
        )

        if not re.fullmatch(r"\d{8,13}", barcode) or barcode in seen:
            continue
        if _text(item, "bIsWeighted") == "1":
            continue
        # a name that is just digits (or the barcode again) gives the player nothing to go on
        if len(name) < 3 or re.fullmatch(r"[\d\s.\-]+", name):
            continue
        try:
            price = float(_text(item, "ItemPrice"))
        except ValueError:
            continue
        if not MIN_PRICE <= price <= MAX_PRICE:
            continue

        seen.add(barcode)
        manufacturer = _text(item, "ManufactureName")
        out.append(
            {
                "barcode": barcode,
                "name": name,
                "price": round(price, 2),
                "manufacturer": "" if manufacturer == UNKNOWN else manufacturer,
                "size": package_size(_text(item, "Quantity"), _text(item, "UnitOfMeasure")),
            }
        )
    return out


async def verify_images(barcodes: list[str], cache: dict[str, bool]) -> dict[str, bool]:
    todo = [b for b in barcodes if b not in cache]
    print(f"{len(barcodes) - len(todo)} cached, probing {len(todo)}")
    if not todo:
        return cache

    sem = asyncio.Semaphore(CONCURRENCY)
    done = 0

    async with httpx.AsyncClient(timeout=20.0) as client:

        async def probe(barcode: str) -> None:
            nonlocal done
            async with sem:
                try:
                    resp = await client.head(IMG.format(barcode=barcode, size="small"))
                    cache[barcode] = resp.status_code == 200
                except httpx.HTTPError:
                    cache[barcode] = False
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{len(todo)}")

        await asyncio.gather(*(probe(b) for b in todo))

    return cache


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="probe only the first N items (sampling)")
    args = parser.parse_args()

    src = newest_pricefull()
    items = parse_items(src)
    print(f"{src.name}: {len(items)} items pass the non-image filters")
    if args.limit:
        items = items[: args.limit]

    cache = json.loads(IMAGE_CACHE.read_text()) if IMAGE_CACHE.exists() else {}
    try:
        cache = asyncio.run(verify_images([i["barcode"] for i in items], cache))
    finally:
        IMAGE_CACHE.write_text(json.dumps(cache))

    pool = [i for i in items if cache.get(i["barcode"])]
    pool.sort(key=lambda i: i["barcode"])
    print(f"{len(pool)} of {len(items)} have images ({len(pool) / max(len(items), 1):.0%})")

    POOL.write_text(
        json.dumps({"store": "001", "source": src.name, "items": pool}, ensure_ascii=False, indent=1)
    )
    print(f"wrote {POOL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
