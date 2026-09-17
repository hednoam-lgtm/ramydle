const TILE = { hit: '🟩', close: '🟨', far: '🟥' }
const ARROW = { up: '🔼', down: '🔽', same: '' }

// Set VITE_SITE_URL to pin a canonical domain. Otherwise derive it from the page,
// resolving BASE_URL so a GitHub Pages project subpath (/ramydle/) survives.
const SITE_URL = (
  import.meta.env.VITE_SITE_URL ||
  new URL(import.meta.env.BASE_URL, window.location.href).href
).replace(/\/$/, '')

export function buildShareText(puzzleNumber, results, solved, maxGuesses) {
  const score = solved ? `${results.length}/${maxGuesses}` : `X/${maxGuesses}`
  const grid = results.map((r) => TILE[r.proximity] + ARROW[r.direction]).join(' ')
  return `רמידל #${puzzleNumber} ${score}\n${grid}\n${SITE_URL}`
}

export async function copyShare(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function buildVersusShareText(puzzleNumber, results) {
  const score = results.filter((r) => r.correct).length
  const grid = results.map((r) => (r.correct ? '🟩' : '🟥')).join(' ')
  // The hash lands the reader in the mode the result came from.
  return `רמידל · מה יקר יותר? #${puzzleNumber} ${score}/${results.length}\n${grid}\n${SITE_URL}/#versus`
}
