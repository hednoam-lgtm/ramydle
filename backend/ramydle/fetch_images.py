"""Download and downscale every pooled product photo for self-hosting.

The CDN serves 1024px originals; the card renders them in a 190px box, so we
resize to 480px (sharp through ~2.5x DPR) and store WebP. That lands around
16 KB per image — smaller than the CDN's own 320px `small.jpg`, and sharper.

Idempotent: images already on disk are skipped, so re-running after a pool
refresh only fetches products that are new.
"""

import argparse
import asyncio
import io
import json
import sys
from pathlib import Path

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
POOL = ROOT / "backend" / "data" / "pool.json"
OUT = ROOT / "frontend" / "public" / "products"

SRC = "https://img.rami-levy.co.il/product/{barcode}/large.jpg"
MAX_PX = 480
QUALITY = 82

# The CDN rate-limits hard: 8 parallel streams earned a 429 on every request
# within seconds, and the block outlived the burst. Two workers spaced ~0.4s
# apart (~5 req/s) sustain the whole run. A 429 pauses every worker at once,
# because retrying independently only feeds the block.
CONCURRENCY = 2
MIN_INTERVAL = 0.6
MAX_RETRIES = 8
COOLDOWN_START = 20.0
COOLDOWN_MAX = 900.0


def encode(raw: bytes) -> bytes:
    image = Image.open(io.BytesIO(raw))
    # Flatten alpha onto white — the cards sit on a light surface.
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        canvas = Image.new("RGB", image.size, (255, 255, 255))
        canvas.paste(image, mask=image.split()[-1])
        image = canvas
    else:
        image = image.convert("RGB")
    image.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
    buf = io.BytesIO()
    image.save(buf, "WEBP", quality=QUALITY, method=6)
    return buf.getvalue()


class Throttle:
    """Paces requests, and parks every worker when the CDN pushes back."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._next = 0.0
        self._open = asyncio.Event()
        self._open.set()
        self._cooldown = COOLDOWN_START

    async def wait(self) -> None:
        await self._open.wait()
        async with self._lock:
            now = asyncio.get_running_loop().time()
            delay = max(0.0, self._next - now)
            self._next = max(now, self._next) + MIN_INTERVAL
        if delay:
            await asyncio.sleep(delay)

    async def back_off(self, retry_after: str | None) -> None:
        if not self._open.is_set():
            await self._open.wait()  # another worker is already serving the penalty
            return
        self._open.clear()
        pause = self._cooldown
        if retry_after and retry_after.isdigit():
            pause = max(pause, float(retry_after))
        print(f"  rate limited — pausing {pause:.0f}s")
        await asyncio.sleep(pause)
        self._cooldown = min(self._cooldown * 2, COOLDOWN_MAX)
        self._next = asyncio.get_running_loop().time()
        self._open.set()

    def ok(self) -> None:
        self._cooldown = COOLDOWN_START


async def download(barcodes: list[str]) -> tuple[int, list[str], list[str]]:
    todo = [b for b in barcodes if not (OUT / f"{b}.webp").exists()]
    print(f"{len(barcodes) - len(todo)} already on disk, fetching {len(todo)}")
    if not todo:
        return 0, [], []

    sem = asyncio.Semaphore(CONCURRENCY)
    throttle = Throttle()
    absent: list[str] = []  # the CDN answered, and there is no such image
    throttled: list[str] = []  # never got an answer; worth another run
    written = 0
    done = 0

    async with httpx.AsyncClient(timeout=30.0) as client:

        async def grab(barcode: str) -> None:
            nonlocal written, done
            async with sem:
                for _ in range(MAX_RETRIES):
                    await throttle.wait()
                    try:
                        resp = await client.get(SRC.format(barcode=barcode))
                    except httpx.HTTPError:
                        await throttle.back_off(None)
                        continue
                    if resp.status_code == 429:
                        await throttle.back_off(resp.headers.get("retry-after"))
                        continue
                    throttle.ok()
                    if resp.status_code == 200:
                        try:
                            # Encoding is CPU-bound; keep it off the event loop.
                            data = await asyncio.to_thread(encode, resp.content)
                            (OUT / f"{barcode}.webp").write_bytes(data)
                            written += 1
                        except (OSError, ValueError):
                            absent.append(barcode)
                    else:
                        absent.append(barcode)  # the CDN answered; there is no image
                    break
                else:
                    # Only ever throttled or errored — not proof the image is missing.
                    throttled.append(barcode)
            done += 1
            if done % 200 == 0:
                print(f"  {done}/{len(todo)} ({written} written)")

        await asyncio.gather(*(grab(b) for b in todo))

    return written, absent, throttled


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="fetch only the first N products")
    args = parser.parse_args()

    if not POOL.exists():
        print(f"missing {POOL} — run build_pool.py first", file=sys.stderr)
        return 1

    barcodes = [i["barcode"] for i in json.loads(POOL.read_text())["items"]]
    if args.limit:
        barcodes = barcodes[: args.limit]

    OUT.mkdir(parents=True, exist_ok=True)
    written, absent, throttled = asyncio.run(download(barcodes))

    total = sum(f.stat().st_size for f in OUT.glob("*.webp"))
    have = len(list(OUT.glob("*.webp")))
    print(f"wrote {written}, {len(absent)} absent upstream, {len(throttled)} throttled")
    print(f"{have}/{len(barcodes)} products have a local image, {total / 1024 / 1024:.1f} MB total")
    if throttled:
        print(f"rate limited on {len(throttled)} — re-run later, they will be retried")
    # Every puzzle needs a photo, so an incomplete run must not look like success.
    return 1 if throttled or have < len(barcodes) else 0


if __name__ == "__main__":
    sys.exit(main())
