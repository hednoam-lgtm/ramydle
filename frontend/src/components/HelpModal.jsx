import Modal from './Modal'

export default function HelpModal({ mode, onClose }) {
  if (mode === 'versus') {
    return (
      <Modal title="איך משחקים" onClose={onClose}>
        <ul className="help">
          <li>ארבע שאלות ביום: בכל אחת שתי עגלות, ועליכם לבחור את היקרה יותר.</li>
          <li>בכל עגלה יש כמה יחידות של מוצר אחד — למשל 4 מילקי מול 5 גבינה לבנה.</li>
          <li>ההפרש בין העגלות תמיד בין 20% ל־70%, כדי שלא יהיה מובן מאליו ולא הגרלה.</li>
          <li>
            <span className="chip hit" /> בחירה נכונה · <span className="chip far" /> בחירה שגויה.
          </li>
          <li>יש הזדמנות אחת לכל שאלה. סבב חדש כל יום.</li>
        </ul>
      </Modal>
    )
  }

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
