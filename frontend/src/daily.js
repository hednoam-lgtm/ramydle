/**
 * Deterministic daily product selection and guess scoring.
 *
 * This runs in the browser, so the pool — answers included — ships to the client.
 * That is inherent to a static build; Costcodle works the same way.
 */

const EPOCH_UTC = Date.UTC(2026, 0, 1)
const SALT = 'ramydle'
const IMAGE_URL = 'https://img.rami-levy.co.il/product/{barcode}/large.jpg'

export const MAX_GUESSES = 6
const WIN_TOLERANCE = 0.05
const CLOSE_TOLERANCE = 0.25

/** Today's date in Israel as YYYY-MM-DD, so the puzzle rolls over at local midnight. */
export function todayInIsrael() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
}

export function puzzleNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_UTC) / 86_400_000)
}

function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Order the pool for one full pass through it. Every product is used once per
 * cycle before any repeats, and each cycle reshuffles.
 */
function permutation(cycle, size) {
  const rand = mulberry32(xmur3(`${SALT}:${cycle}`))
  const order = Array.from({ length: size }, (_, i) => i)
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function productFor(iso, pool) {
  const n = puzzleNumber(iso)
  const size = pool.length
  const cycle = Math.floor(n / size)
  const offset = ((n % size) + size) % size
  const item = pool[permutation(cycle, size)[offset]]
  return { ...item, imageUrl: IMAGE_URL.replace('{barcode}', item.barcode) }
}

export function scoreGuess(guess, price) {
  const delta = (guess - price) / price
  if (Math.abs(delta) <= WIN_TOLERANCE) {
    return { guess, correct: true, direction: 'same', proximity: 'hit' }
  }
  return {
    guess,
    correct: false,
    direction: delta > 0 ? 'down' : 'up',
    proximity: Math.abs(delta) <= CLOSE_TOLERANCE ? 'close' : 'far',
  }
}

export function scoreRound(guesses, price) {
  const results = []
  for (const guess of guesses.slice(0, MAX_GUESSES)) {
    results.push(scoreGuess(guess, price))
    if (results[results.length - 1].correct) break
  }
  const solved = results.length > 0 && results[results.length - 1].correct
  const finished = solved || results.length >= MAX_GUESSES
  return { results, solved, finished, actualPrice: finished ? price : null }
}
