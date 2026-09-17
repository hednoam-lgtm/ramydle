const GAME_KEY = 'ramydle:game'
const STATS_KEY = 'ramydle:stats'

const EMPTY_STATS = {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0],
}

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function loadGame(date) {
  const game = read(GAME_KEY, null)
  return game && game.date === date ? game : { date, guesses: [] }
}

export function saveGame(game) {
  localStorage.setItem(GAME_KEY, JSON.stringify(game))
}

export function loadStats() {
  return read(STATS_KEY, EMPTY_STATS)
}

export function recordResult(date, solved, guessCount) {
  const stats = loadStats()
  if (stats.lastPlayed === date) return stats

  const next = {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (solved ? 1 : 0),
    currentStreak: solved ? stats.currentStreak + 1 : 0,
    distribution: [...stats.distribution],
    lastPlayed: date,
  }
  next.maxStreak = Math.max(stats.maxStreak, next.currentStreak)
  if (solved) next.distribution[guessCount - 1] += 1

  localStorage.setItem(STATS_KEY, JSON.stringify(next))
  return next
}

/* --- "which basket costs more" mode: its own progress and its own stats --- */

const VERSUS_GAME_KEY = 'ramydle:versus:game'
const VERSUS_STATS_KEY = 'ramydle:versus:stats'

const EMPTY_VERSUS_STATS = {
  played: 0,
  wins: 0, // days answered perfectly
  currentStreak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0], // index = correct answers that day, 0..4
}

export function loadVersusGame(date) {
  const game = read(VERSUS_GAME_KEY, null)
  return game && game.date === date ? game : { date, picks: [] }
}

export function saveVersusGame(game) {
  localStorage.setItem(VERSUS_GAME_KEY, JSON.stringify(game))
}

export function loadVersusStats() {
  return read(VERSUS_STATS_KEY, EMPTY_VERSUS_STATS)
}

export function recordVersusResult(date, score, total) {
  const stats = loadVersusStats()
  if (stats.lastPlayed === date) return stats

  // A day counts as a win only when every question was right; anything less keeps
  // the streak honest.
  const perfect = score === total
  const next = {
    ...stats,
    played: stats.played + 1,
    wins: stats.wins + (perfect ? 1 : 0),
    currentStreak: perfect ? stats.currentStreak + 1 : 0,
    distribution: [...stats.distribution],
    lastPlayed: date,
  }
  next.maxStreak = Math.max(stats.maxStreak, next.currentStreak)
  if (score < next.distribution.length) next.distribution[score] += 1

  localStorage.setItem(VERSUS_STATS_KEY, JSON.stringify(next))
  return next
}
