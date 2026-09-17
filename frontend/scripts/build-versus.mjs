/**
 * Build (or refresh) the frozen daily sequence for the "which basket costs more" mode.
 *
 * Each day is ROUNDS_PER_DAY questions, and each question is two baskets:
 * a quantity of one product against a quantity of another ("4 מילקי" vs
 * "5 גבינה לבנה"). The quantities are chosen so the two totals always differ
 * by between MIN_GAP and MAX_GAP — close enough that the answer is not obvious,
 * far enough that it is knowable.
 *
 * Frozen like puzzles.json and for the same reason: deriving the sequence in the
 * browser from a live pool means a price refresh silently re-deals days that have
 * already been played. Here it would be worse than a swapped product — a new price
 * can flip which basket is the expensive one, turning a past win into a loss. So
 * days up to and including today keep their products, quantities and unit prices
 * verbatim; only future days are re-dealt.
 *
 * Product labels are not history: the price feed truncates names, so a fuller name
 * for the same barcode is a fix, and the products table is always rebuilt fresh.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { seeded } from './rng.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const POOL = path.join(HERE, '../../backend/data/pool.json')
const OUT = path.join(HERE, '../public/versus.json')

const EPOCH_UTC = Date.UTC(2026, 0, 1)
const SALT = 'ramydle:versus'

const HORIZON = 1000 // days dealt ahead — ~2.7 years, and re-runnable for more
const ROUNDS_PER_DAY = 4
const MAX_QTY = 6
// How far apart the two baskets must be, as a share of the cheaper one.
const MIN_GAP = 0.2
const MAX_GAP = 0.7
// Keep a basket to a sum a shopper can picture; without it a 6×₪167 side is legal.
const MAX_BASKET = 250
const MAX_PAIR_TRIES = 300

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())
const todayIndex = Math.round(
  (Date.UTC(...today.split('-').map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))) - EPOCH_UTC) /
    86_400_000,
)

const round2 = (n) => Math.round(n * 100) / 100

/** Every (a, b) that puts the two totals inside the gap band, cheapest side as the base. */
function quantityOptions(priceA, priceB) {
  const options = []
  for (let a = 1; a <= MAX_QTY; a++) {
    for (let b = 1; b <= MAX_QTY; b++) {
      const totalA = round2(a * priceA)
      const totalB = round2(b * priceB)
      if (totalA > MAX_BASKET || totalB > MAX_BASKET) continue
      const hi = Math.max(totalA, totalB)
      const lo = Math.min(totalA, totalB)
      const gap = (hi - lo) / lo
      if (gap >= MIN_GAP && gap <= MAX_GAP) options.push([a, b])
    }
  }
  return options
}

function dealRound(rand, items, used) {
  for (let tries = 0; tries < MAX_PAIR_TRIES; tries++) {
    const a = items[Math.floor(rand() * items.length)]
    const b = items[Math.floor(rand() * items.length)]
    if (a.barcode === b.barcode || used.has(a.barcode) || used.has(b.barcode)) continue

    const options = quantityOptions(a.price, b.price)
    if (!options.length) continue
    // 1-vs-1 is a legal question but a dull one in a mode that is about baskets,
    // so it is only used when the pair admits nothing else.
    const multi = options.filter(([qa, qb]) => qa > 1 || qb > 1)
    const pick = (multi.length ? multi : options)[Math.floor(rand() * (multi.length || options.length))]

    used.add(a.barcode)
    used.add(b.barcode)
    return [
      { barcode: a.barcode, qty: pick[0], price: a.price },
      { barcode: b.barcode, qty: pick[1], price: b.price },
    ]
  }
  throw new Error(`no pair in the pool satisfies the ${MIN_GAP}–${MAX_GAP} gap after ${MAX_PAIR_TRIES} tries`)
}

function dealDay(dayIndex, items) {
  const rand = seeded(`${SALT}:${dayIndex}`)
  const used = new Set() // no product twice in one day, on either side
  return Array.from({ length: ROUNDS_PER_DAY }, () => dealRound(rand, items, used))
}

/** One line per day / product: small enough to ship, still readable in a diff. */
function serialise(doc) {
  const rows = (list) => list.map((row) => `  ${JSON.stringify(row)}`).join(',\n')
  return `{
 "epoch": ${JSON.stringify(doc.epoch)},
 "store": ${JSON.stringify(doc.store)},
 "rounds": ${doc.rounds},
 "gap": [${MIN_GAP}, ${MAX_GAP}],
 "products": [
${rows(doc.products)}
 ],
 "days": [
${rows(doc.days)}
 ]
}
`
}

const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'))
const byBarcode = new Map(pool.items.map((i) => [i.barcode, i]))

// Labels for products that have since left the pool, so a frozen day never dangles.
const lastKnown = new Map()
let days = []
if (fs.existsSync(OUT)) {
  const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'))
  for (const p of existing.products) lastKnown.set(p.barcode, p)
  days = existing.days.map((day) =>
    day.map((question) =>
      question.map(([index, qty, price]) => ({
        barcode: existing.products[index].barcode,
        qty,
        price,
      })),
    ),
  )
}

const frozen = Math.min(days.length, todayIndex + 1)
let dealt = 0
for (let i = 0; i < HORIZON; i++) {
  if (i < frozen) continue // played, or being played right now — never re-deal
  days[i] = dealDay(i, pool.items)
  dealt++
}
days = days.slice(0, Math.max(HORIZON, frozen))

// Table the days index into: fresh labels from the pool, last-known ones for the rest.
const usedBarcodes = [...new Set(days.flat(2).map((side) => side.barcode))].sort()
const products = usedBarcodes.map((barcode) => {
  const fresh = byBarcode.get(barcode)
  const src = fresh ?? lastKnown.get(barcode)
  if (!src) throw new Error(`no label known for ${barcode}`)
  return {
    barcode,
    name: src.name,
    manufacturer: src.manufacturer ?? '',
    size: src.size ?? '',
  }
})
const indexOf = new Map(products.map((p, i) => [p.barcode, i]))

fs.writeFileSync(
  OUT,
  serialise({
    epoch: '2026-01-01',
    store: pool.store,
    rounds: ROUNDS_PER_DAY,
    products,
    days: days.map((day) =>
      day.map((question) => question.map((s) => [indexOf.get(s.barcode), s.qty, s.price])),
    ),
  }),
)

const sample = days[todayIndex]
console.log(`froze ${frozen} day(s), dealt ${dealt}`)
console.log(`today is ${today} = round #${todayIndex}:`)
for (const question of sample) {
  const label = (s) => `${s.qty} × ${products[indexOf.get(s.barcode)].name} (₪${round2(s.qty * s.price)})`
  console.log(`  ${label(question[0])}  vs  ${label(question[1])}`)
}
console.log(`wrote ${days.length} days to ${path.relative(process.cwd(), OUT)}`)
