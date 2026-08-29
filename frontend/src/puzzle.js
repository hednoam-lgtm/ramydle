import { MAX_GUESSES, productFor, puzzleNumber, todayInIsrael } from './daily'

// Relative to BASE_URL so the same build works on a project subpath and a custom domain.
const PUZZLES_URL = `${import.meta.env.BASE_URL}puzzles.json`

let cached = null

async function loadPuzzles() {
  if (!cached) {
    const resp = await fetch(PUZZLES_URL)
    if (!resp.ok) throw new Error('failed to load puzzles')
    cached = await resp.json()
    if (!cached.puzzles?.length) throw new Error('puzzle sequence is empty')
  }
  return cached
}

export async function loadPuzzle() {
  const data = await loadPuzzles()
  const date = todayInIsrael()
  const { price, ...product } = productFor(date, data.puzzles)
  return {
    date,
    puzzleNumber: puzzleNumber(date),
    maxGuesses: MAX_GUESSES,
    store: data.store,
    product: {
      ...product,
      imageUrl: `${import.meta.env.BASE_URL}products/${product.barcode}.webp`,
    },
    price,
  }
}
