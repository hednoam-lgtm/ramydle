import Modal from './Modal'

export default function StatsModal({ stats, onClose }) {
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0
  const peak = Math.max(...stats.distribution, 1)

  return (
    <Modal title="סטטיסטיקה" onClose={onClose}>
      <div className="stat-row">
        <Stat value={stats.played} label="משחקים" />
        <Stat value={`${winRate}%`} label="אחוז ניצחון" />
        <Stat value={stats.currentStreak} label="רצף נוכחי" />
        <Stat value={stats.maxStreak} label="רצף שיא" />
      </div>

      <h3 className="dist-title">התפלגות ניחושים</h3>
      <ul className="dist">
        {stats.distribution.map((count, i) => (
          <li key={i}>
            <span className="dist-label">{i + 1}</span>
            <span className="dist-bar" style={{ width: `${(count / peak) * 100}%` }}>
              {count}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
