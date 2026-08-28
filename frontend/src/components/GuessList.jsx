const HINT = {
  hit: 'בול!',
  close: 'קרוב',
  far: 'רחוק',
}

const ARROW = { up: '▲', down: '▼', same: '✓' }

export default function GuessList({ results, maxGuesses }) {
  const empties = Array.from({ length: Math.max(maxGuesses - results.length, 0) })

  return (
    <ol className="guess-list">
      {results.map((r, i) => (
        <li key={i} className={`guess-row ${r.proximity}`}>
          <span className="guess-value">₪{r.guess.toFixed(2)}</span>
          <span className="guess-hint">{HINT[r.proximity]}</span>
          <span className="guess-arrow" aria-label={r.direction}>
            {ARROW[r.direction]}
          </span>
        </li>
      ))}
      {empties.map((_, i) => (
        <li key={`empty-${i}`} className="guess-row empty" />
      ))}
    </ol>
  )
}
