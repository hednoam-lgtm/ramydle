/**
 * Build (or refresh) the frozen daily puzzle sequence.
 *
 * The game used to derive each day's product from pool.json with a seeded
 * shuffle. That is only stable while the pool never changes — refreshing
 * prices adds and removes products, which silently re-dealt every past and
 * future day, including today's mid-play.
 *
 * So the sequence is dealt exactly once and written to disk. Index = puzzle
 * number (days since EPOCH). Later runs never re-deal: they freeze everything
 * up to and including today, refresh prices only for future days, and append
 * genuinely new products to the end.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const POOL = path.join(HERE, '../../backend/data/pool.json')
const OUT = path.join(HERE, '../public/puzzles.json')

const EPOCH_UTC = Date.UTC(2026, 0, 1)
const SALT = 'ramydle'

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
const todayIndex = Math.round(
  (Date.UTC(...today.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) - EPOCH_UTC) /
    86_400_000,
)

// --- the original deal, kept verbatim so the first build reproduces live history ---
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

function permutation(cycle, size) {
  const rand = mulberry32(xmur3(`${SALT}:${cycle}`))
  const order = Array.from({ length: size }, (_, i) => i)
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

function deal(pool) {
  // Cycle 0 covered puzzle numbers 0..pool.length-1, which is every day the
  // game has been or will be live for the next five years.
  return permutation(0, pool.length).map((i) => pool[i])
}

const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'))
const byBarcode = new Map(pool.items.map((i) => [i.barcode, i]))

let puzzles
if (fs.existsSync(OUT)) {
  const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  let repriced = 0
  let relabelled = 0
  puzzles = existing.puzzles.map((p, i) => {
    const fresh = byBarcode.get(p.barcode)
    if (!fresh) return p // left the pool — keep the last-known copy so no day dangles
    if (i <= todayIndex) {
      // Already played. Which product it was and what it cost are history and stay
      // frozen. The label is not history — the price feed truncates names at 20
      // characters, so a fuller name for the same product is a fix, not a rewrite.
      if (fresh.name !== p.name) relabelled++
      return { ...p, name: fresh.name, manufacturer: fresh.manufacturer, size: fresh.size }
    }
    if (fresh.price !== p.price) repriced++
    return { ...fresh }
  })
  const known = new Set(puzzles.map((p) => p.barcode))
  const added = pool.items.filter((i) => !known.has(i.barcode))
  puzzles.push(...added)
  console.log(`froze ${Math.min(todayIndex + 1, puzzles.length)} played day(s)`)
  console.log(`relabelled ${relabelled} played day(s) — names only, prices untouched`)
  console.log(`repriced ${repriced} future day(s), appended ${added.length} new product(s)`)
} else {
  puzzles = deal(pool.items)
  console.log(`first build: dealt ${puzzles.length} days from the pool`)
}

fs.writeFileSync(
  OUT,
  JSON.stringify({ epoch: '2026-01-01', store: pool.store, puzzles }, null, 1),
)
console.log(`today is ${today} = puzzle #${todayIndex}: ${puzzles[todayIndex].name}`)
console.log(`wrote ${puzzles.length} puzzles to ${path.relative(process.cwd(), OUT)}`)
