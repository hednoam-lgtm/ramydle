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
```

The first pool build probes every barcode against the image CDN and takes a while. Results are
cached in `data/image_cache.json`, so later runs only probe barcodes they haven't seen.

`pool.json` is committed, so the game runs without re-fetching. Re-run both scripts to refresh
prices.

## Running

```bash
cd frontend && npm run dev
```

Open http://localhost:5173. There is no server to run — the game is fully static, and Python is
only used offline to build the pool.

## How the daily puzzle works

Selection is deterministic and runs in the browser (`src/daily.js`). The puzzle number is days
since 2026-01-01, and each cycle through the pool is a seeded shuffle — so every product appears
once before any repeats, and a given date always yields the same product. The day rolls over at
midnight in `Asia/Jerusalem`.

**The pool ships to the client, so the answers are readable in devtools.** That is inherent to a
static build; Costcodle has the same property. A player who wants to cheat can, but has to work for
it. Hiding the answer would require a backend.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds `frontend/` and publishes it on every push to `main`. In the
repo, set **Settings → Pages → Source** to **GitHub Actions** once; nothing else is needed.

The build uses a relative asset base, so the same artifact works both at
`username.github.io/ramydle/` and at the root of a custom domain.

For a custom domain: point a `CNAME` DNS record at `username.github.io`, enter the domain under
Settings → Pages, and commit a `CNAME` file in `frontend/public/` containing just the domain.

Shared results end with a link back to the game, derived from wherever the page is served — correct
on both the github.io subpath and a custom domain with no configuration. To pin one canonical URL
regardless of where a player loaded the game, set a repository variable `SITE_URL`
(Settings → Secrets and variables → Actions → Variables). See `frontend/.env.example`.

## Keeping prices fresh

`pool.json` is a snapshot. Re-run the two scripts above and commit the result to refresh prices;
the push redeploys automatically. Product photos are hotlinked from `img.rami-levy.co.il` rather
than self-hosted, so they cost no repo space but will all break at once if that CDN starts
rejecting cross-origin requests.
