import { MAX_GUESSES, productFor, puzzleNumber, todayInIsrael } from './daily'

// Relative to BASE_URL so the same build works on a project subpath and a custom domain.
const POOL_URL = `${import.meta.env.BASE_URL}pool.json`

let cached = null

async function loadPool() {
  if (!cached) {
    const resp = await fetch(POOL_URL)
    if (!resp.ok) throw new Error('failed to load pool')
    cached = await resp.json()
    if (!cached.items?.length) throw new Error('pool is empty')
  }
  return cached
}

export async function loadPuzzle() {
  const pool = await loadPool()
  const date = todayInIsrael()
  const { price, ...product } = productFor(date, pool.items)
  return {
    date,
    puzzleNumber: puzzleNumber(date),
    maxGuesses: MAX_GUESSES,
    store: pool.store,
    product,
    price,
  }
}
