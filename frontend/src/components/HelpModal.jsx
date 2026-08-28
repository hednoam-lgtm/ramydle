import Modal from './Modal'

export default function HelpModal({ onClose }) {
  return (
    <Modal title="איך משחקים" onClose={onClose}>
      <ul className="help">
        <li>נחשו את מחירו של מוצר מרמי לוי ב־6 ניסיונות.</li>
        <li>
          <span className="chip hit" /> ניחוש בטווח של 5% מהמחיר — ניצחתם.
        </li>
        <li>
          <span className="chip close" /> בטווח של 25% מהמחיר.
        </li>
        <li>
          <span className="chip far" /> רחוק מ־25% מהמחיר.
        </li>
        <li>
          ▲ המחיר גבוה מהניחוש · ▼ המחיר נמוך מהניחוש.
        </li>
        <li>מוצר חדש כל יום.</li>
      </ul>
    </Modal>
  )
}
