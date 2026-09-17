import { useEffect, useState } from 'react'
import { loadStats, loadVersusStats } from './storage'
import DailyGame from './components/DailyGame'
import VersusGame from './components/VersusGame'
import StatsModal from './components/StatsModal'
import HelpModal from './components/HelpModal'

const MODES = [
  { id: 'daily', label: 'ניחוש מחיר' },
  { id: 'versus', label: 'מה יקר יותר?' },
]

// Each mode keeps its own stats, so the stats panel is labelled per mode.
const STATS_VIEW = {
  daily: {
    rateLabel: 'אחוז ניצחון',
    distTitle: 'התפלגות ניחושים',
    distLabels: ['1', '2', '3', '4', '5', '6'],
    load: loadStats,
  },
  versus: {
    rateLabel: 'ימים מושלמים',
    distTitle: 'תשובות נכונות ביום',
    distLabels: ['0', '1', '2', '3', '4'],
    load: loadVersusStats,
  },
}

function modeFromHash() {
  return window.location.hash.replace(/^#\/?/, '') === 'versus' ? 'versus' : 'daily'
}

export default function App() {
  const [mode, setMode] = useState(modeFromHash)
  const [showStats, setShowStats] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // Fall back to the wordmark in text if the logo file is ever missing.
  const [logoFailed, setLogoFailed] = useState(false)

  // The mode lives in the hash, so a shared result opens the mode it came from.
  useEffect(() => {
    const sync = () => setMode(modeFromHash())
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  function switchMode(next) {
    if (next === mode) return
    const url = next === 'daily' ? window.location.pathname + window.location.search : '#versus'
    window.history.replaceState(null, '', url)
    setMode(next)
    setShowStats(false)
    setShowHelp(false)
  }

  const view = STATS_VIEW[mode]

  return (
    <div className="app">
      <header className="header">
        <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="הסבר">
          ?
        </button>
        <h1 className="title">
          {logoFailed ? (
            'רמידל'
          ) : (
            <img
              className="logo"
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="רמידל"
              onError={() => setLogoFailed(true)}
            />
          )}
        </h1>
        <button className="icon-btn" onClick={() => setShowStats(true)} aria-label="סטטיסטיקה">
          ▤
        </button>
      </header>

      <nav className="modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-tab ${m.id === mode ? 'active' : ''}`}
            aria-current={m.id === mode}
            onClick={() => switchMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      {mode === 'versus' ? (
        <VersusGame key="versus" onFinish={() => setTimeout(() => setShowStats(true), 1200)} />
      ) : (
        <DailyGame key="daily" onFinish={() => setTimeout(() => setShowStats(true), 1200)} />
      )}

      {showStats && (
        // Read at open time: the game just wrote the result to localStorage.
        <StatsModal
          stats={view.load()}
          rateLabel={view.rateLabel}
          distTitle={view.distTitle}
          distLabels={view.distLabels}
          onClose={() => setShowStats(false)}
        />
      )}
      {showHelp && <HelpModal mode={mode} onClose={() => setShowHelp(false)} />}
    </div>
  )
}
