import { useEffect, useState } from 'react'
import { costlierSide, loadVersusDay, scoreVersus } from '../versus'
import { loadVersusGame, saveVersusGame, recordVersusResult } from '../storage'
import { buildVersusShareText, copyShare } from '../share'
import BasketCard from './BasketCard'

const VERDICT = ['לא היום…', 'אפשר יותר טוב', 'לא רע', 'כמעט מושלם', 'מושלם! 🎉']

export default function VersusGame({ onFinish }) {
  const [day, setDay] = useState(null)
  const [picks, setPicks] = useState([])
  // True while the answer to the question just picked is on screen.
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadVersusDay()
      .then((data) => {
        setDay(data)
        setPicks(loadVersusGame(data.date).picks)
      })
      .catch(() => setError('לא הצלחנו לטעון את המשחק היומי'))
  }, [])

  // Warm the next question's photos while the answer is still on screen, so the
  // cards do not flash empty when the player advances.
  useEffect(() => {
    for (const basket of day?.questions[picks.length] ?? []) {
      new Image().src = basket.imageUrl
    }
  }, [day, picks.length])

  if (error) return <div className="state-msg">{error}</div>
  if (!day) return <div className="state-msg">טוען…</div>

  const total = day.questions.length
  const round = scoreVersus(picks, day.questions)
  const done = round.finished && !revealed
  const index = revealed ? picks.length - 1 : picks.length

  function choose(side) {
    const next = [...picks, side]
    setPicks(next)
    setRevealed(true)
    saveVersusGame({ date: day.date, picks: next })

    const after = scoreVersus(next, day.questions)
    if (after.finished) recordVersusResult(day.date, after.score, total)
  }

  function advance() {
    setRevealed(false)
    if (round.finished) onFinish()
  }

  async function handleShare() {
    setCopied(await copyShare(buildVersusShareText(day.puzzleNumber, round.results)))
    setTimeout(() => setCopied(false), 2000)
  }

  // Once the day is done `index` points past the last question, so there is
  // nothing to render a card for.
  const question = done ? null : day.questions[index]
  const answer = question ? costlierSide(question) : -1
  const card = (side) => (
    <BasketCard
      basket={question[side]}
      revealed={revealed}
      state={cardState(side, revealed, picks[index], answer)}
      onPick={() => choose(side)}
    />
  )

  const pips = (
    <ol className="pips" aria-label={`${round.score} מתוך ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const result = round.results[i]
        const cls = result ? (result.correct ? 'correct' : 'wrong') : i === index ? 'current' : ''
        return <li key={i} className={cls} />
      })}
    </ol>
  )

  return (
    <>
      <p className="subtitle">איזו עגלה יקרה יותר?</p>
      {pips}

      {done ? (
        <div className="result">
          <p className="verdict">{VERDICT[round.score]}</p>
          <p className="actual">
            <strong>
              {round.score}/{total}
            </strong>{' '}
            תשובות נכונות
          </p>
          <button className="primary-btn" onClick={handleShare}>
            {copied ? 'הועתק!' : 'שיתוף התוצאה'}
          </button>
          <p className="remaining">סבב חדש מחר</p>
        </div>
      ) : (
        <>
          <p className="remaining">
            שאלה {index + 1} מתוך {total}
          </p>

          <div className="versus">
            {card(0)}
            <span className="versus-or" aria-hidden="true">
              או
            </span>
            {card(1)}
          </div>

          {revealed && (
            <button className="primary-btn" onClick={advance}>
              {round.finished ? 'לתוצאות' : 'לשאלה הבאה'}
            </button>
          )}
        </>
      )}

      <footer className="footer">
        מחירים מתוך קובץ שקיפות המחירים של רמי לוי · סניף {day.store}
      </footer>
    </>
  )
}

/** Green marks the costlier basket; red only marks a pick that missed it. */
function cardState(side, revealed, pick, answer) {
  if (!revealed) return ''
  if (side === answer) return 'correct'
  return side === pick ? 'wrong' : ''
}
