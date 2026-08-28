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
