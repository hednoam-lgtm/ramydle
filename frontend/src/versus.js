/**
 * "Which basket costs more" — the second daily mode.
 *
 * Four questions a day, each two baskets: a quantity of one product against a
 * quantity of another. The sequence is dealt offline by scripts/build-versus.mjs
 * and shipped as versus.json, for the same reason the daily product is — see
 * daily.js. Here a re-deal would be worse than a swapped product: a price refresh
 * can flip which basket is the expensive one, turning a past win into a loss.
 *
 * versus.json is fetched only when the mode is opened, so players who never touch
 * it never pay for it.
 */

import { puzzleNumber, todayInIsrael } from './daily'

const VERSUS_URL = `${import.meta.env.BASE_URL}versus.json`

let cached = null

async function loadDays() {
  if (!cached) {
    const resp = await fetch(VERSUS_URL)
    if (!resp.ok) throw new Error('failed to load versus rounds')
    cached = await resp.json()
    if (!cached.days?.length) throw new Error('versus sequence is empty')
  }
  return cached
}

const round2 = (n) => Math.round(n * 100) / 100

export async function loadVersusDay() {
  const data = await loadDays()
  const date = todayInIsrael()
  const n = puzzleNumber(date)
  // Wrap once the sequence runs out rather than break, as the daily mode does.
  const day = data.days[((n % data.days.length) + data.days.length) % data.days.length]

  return {
    date,
    puzzleNumber: n,
    store: data.store,
    gap: data.gap,
    questions: day.map((sides) =>
      sides.map(([index, qty, unitPrice]) => {
        const product = data.products[index]
        return {
          ...product,
          qty,
          unitPrice,
          total: round2(qty * unitPrice),
          imageUrl: `${import.meta.env.BASE_URL}products/${product.barcode}.webp`,
        }
      }),
    ),
  }
}

/** Which basket costs more. A tie is impossible — the builder enforces a ≥20% gap. */
export function costlierSide(question) {
  return question[0].total > question[1].total ? 0 : 1
}

export function scoreVersus(picks, questions) {
  const results = picks.slice(0, questions.length).map((pick, i) => ({
    pick,
    correct: pick === costlierSide(questions[i]),
  }))
  return {
    results,
    score: results.filter((r) => r.correct).length,
    finished: results.length >= questions.length,
  }
}
