import { useEffect, useState } from 'react'
import { loadPuzzle } from '../puzzle'
import { scoreRound } from '../daily'
import { loadGame, saveGame, recordResult } from '../storage'
import { buildShareText, copyShare } from '../share'
import ProductCard from './ProductCard'
import GuessList from './GuessList'

export default function DailyGame({ onFinish }) {
  const [puzzle, setPuzzle] = useState(null)
  const [round, setRound] = useState(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadPuzzle()
      .then((data) => {
        setPuzzle(data)
        const saved = loadGame(data.date)
        setRound(scoreRound(saved.guesses, data.price))
      })
      .catch(() => setError('לא הצלחנו לטעון את המשחק היומי'))
  }, [])

  function handleGuess(event) {
    event.preventDefault()
    const value = Number(input)
    if (!Number.isFinite(value) || value <= 0) {
      setError('הכניסו מחיר תקין')
      return
    }
    setError('')

    const guesses = [...round.results.map((r) => r.guess), value]
    const next = scoreRound(guesses, puzzle.price)
    setRound(next)
    setInput('')
    saveGame({ date: puzzle.date, guesses })

    if (next.finished) {
      recordResult(puzzle.date, next.solved, next.results.length)
      onFinish()
    }
  }

  async function handleShare() {
    const text = buildShareText(
      puzzle.puzzleNumber,
      round.results,
      round.solved,
      puzzle.maxGuesses,
    )
    setCopied(await copyShare(text))
    setTimeout(() => setCopied(false), 2000)
  }

  if (error && !puzzle) return <div className="state-msg">{error}</div>
  if (!puzzle || !round) return <div className="state-msg">טוען…</div>

  const remaining = puzzle.maxGuesses - round.results.length

  return (
    <>
      <p className="subtitle">כמה עולה המוצר הזה ברמי לוי?</p>

      <ProductCard product={puzzle.product} />

      <GuessList results={round.results} maxGuesses={puzzle.maxGuesses} />

      {!round.finished ? (
        <form className="guess-form" onSubmit={handleGuess}>
          <div className="input-wrap">
            <span className="shekel">₪</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="הכניסו מחיר"
              autoFocus
            />
          </div>
          <button type="submit" className="primary-btn">
            נחשו
          </button>
          <p className="remaining">נותרו {remaining} ניחושים</p>
        </form>
      ) : (
        <div className="result">
          <p className="verdict">
            {round.solved ? 'כל הכבוד! 🎉' : 'לא נורא, מחר יום חדש'}
          </p>
          <p className="actual">
            המחיר האמיתי: <strong>₪{round.actualPrice.toFixed(2)}</strong>
          </p>
          <button className="primary-btn" onClick={handleShare}>
            {copied ? 'הועתק!' : 'שיתוף התוצאה'}
          </button>
        </div>
      )}

      {error && puzzle && <p className="error">{error}</p>}

      <footer className="footer">
        מחירים מתוך קובץ שקיפות המחירים של רמי לוי · סניף {puzzle.store}
      </footer>
    </>
  )
}
