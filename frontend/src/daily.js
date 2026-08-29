/**
 * Daily puzzle lookup and guess scoring.
 *
 * The sequence is dealt once, offline, by scripts/build-puzzles.mjs and shipped
 * as puzzles.json — index = puzzle number. It is deliberately NOT derived here:
 * deriving it from a live product pool meant a price refresh silently re-dealt
 * every past and future day, today's included, mid-play.
 */

const EPOCH_UTC = Date.UTC(2026, 0, 1)

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

export function productFor(iso, puzzles) {
  const n = puzzleNumber(iso)
  // Wrap once the sequence runs out, ~5 years in, rather than break.
  return puzzles[((n % puzzles.length) + puzzles.length) % puzzles.length]
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
