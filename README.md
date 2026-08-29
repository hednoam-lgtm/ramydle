# רמידל / Ramydle

A daily price-guessing game in the spirit of [Costcodle](https://costcodle.com/), built on real
Rami Levy grocery prices. Each day shows one product; you have 6 guesses, and you win by landing
within 5% of the shelf price.

## Where the data comes from

Israel's Food Act (2014) requires large retail chains to publish their prices daily in a
machine-readable form. Rami Levy links to its feed from its own
[price transparency page](https://www.rami-levy.co.il/he/price-transparency):
`url.publishedprices.co.il`, username `RamiLevi`, no password.

`fetch_prices.py` pulls the daily `PriceFull` file for one pinned store (default `001`) so all
prices are internally consistent. Product photos come from `img.rami-levy.co.il`, keyed by the same
barcode the price file provides.

Two consequences worth knowing:

- The price file covers everything on the shelves, which is a **superset** of the online catalogue
  that has photos. Only ~16% of items have an image, so `build_pool.py` verifies every barcode
  against the image CDN and keeps only those that resolve. That still yields ~1,960 products —
  over five years of daily puzzles.
- The feed truncates product names at 20 characters (25 in the description field), so some names
  read as clipped mid-word. The photo carries most of the identification.

## Setup

Requires Python 3.11+ and Node 18+.

```bash
# backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# frontend
cd ../frontend && npm install
```

## Building the product pool

```bash
cd backend
.venv/bin/python -m ramydle.fetch_prices --store 001   # download today's PriceFull
.venv/bin/python -m ramydle.build_pool                 # parse, filter, image-verify
.venv/bin/python -m ramydle.fetch_images               # download + downscale photos
cd ../frontend && node scripts/build-puzzles.mjs       # deal / refresh the daily sequence
```

The first pool build probes every barcode against the image CDN and takes a while. Results are
cached in `data/image_cache.json`, so later runs only probe barcodes they haven't seen.

`fetch_images.py` takes ~12 minutes on a cold run and is resumable — it skips anything already on
disk, so after a pool refresh it only fetches genuinely new products. **The CDN rate-limits
aggressively**: eight parallel streams earned a `429` on every request within seconds, and the
block outlasted the burst. The script therefore runs two workers ~0.6s apart and parks *all* of
them on a `429`, since retrying independently only feeds the block. Don't raise the concurrency.

`pool.json` is a build input and is not shipped to the browser; the game loads `puzzles.json`
instead.

## Running

```bash
cd frontend && npm run dev
```

Open http://localhost:5173. There is no server to run — the game is fully static, and Python is
only used offline to build the pool.

## How the daily puzzle works

The puzzle number is days since 2026-01-01, rolling over at midnight in `Asia/Jerusalem`.
`puzzles.json` maps that number straight to a product: index = puzzle number.

**The sequence is dealt once, offline, and never re-dealt.** It used to be derived in the browser
from `pool.json` with a seeded shuffle, which is stable only while the pool never changes — and a
price refresh adds and drops products, which silently re-dealt every past *and future* day. A
player mid-round could have had the answer swapped underneath them.

So `scripts/build-puzzles.mjs` owns the sequence. On a later run it:

- freezes every day up to and including today, prices included — history is never rewritten;
- refreshes prices only for days still in the future;
- appends genuinely new products to the end;
- keeps the last-known copy of a product that has left the pool, so no day can dangle.

**The sequence ships to the client, so the answers are readable in devtools.** That is inherent to
a static build; Costcodle has the same property. A player who wants to cheat can, but has to work
for it. Hiding the answer would require a backend.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds `frontend/` and publishes it on every push to `main`. In the
repo, set **Settings → Pages → Source** to **GitHub Actions** once; nothing else is needed.

The build uses a relative asset base, so the same artifact works both at
`username.github.io/ramydle/` and at the root of a custom domain.

For a custom domain: enter it under Settings → Pages and add the DNS records at your registrar
(four `A` records for the apex, plus a `CNAME` for `www` → `<user>.github.io`). Because this repo
publishes via Actions rather than from a branch, **no `CNAME` file is needed** — GitHub ignores one
if present.

Shared results end with a link back to the game, derived from wherever the page is served — correct
on both the github.io subpath and a custom domain with no configuration. To pin one canonical URL
regardless of where a player loaded the game, set a repository variable `SITE_URL`
(Settings → Secrets and variables → Actions → Variables). See `frontend/.env.example`.

## Keeping prices fresh

`puzzles.json` is a snapshot. Re-run the four commands above and commit the result to refresh
prices; the push redeploys automatically. Days already played keep the price they were played at.

Photos are **self-hosted** in `frontend/public/products/`, not hotlinked. The CDN serves 1024px
originals and the card renders them in a 190px box, so `fetch_images.py` downscales to 480px WebP
— about 16 KB each, ~30 MB for the full pool. That is smaller than the CDN's own 320px `small.jpg`
and sharper on a retina screen, and it means the game has no runtime dependency on
`img.rami-levy.co.il`, which rate-limits and could block referers at any time.

For scale: `puzzles.json` is ~320 KB, so the sequence — not the photo — dominates what a player
downloads per visit.
