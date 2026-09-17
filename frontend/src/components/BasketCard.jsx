import { useState } from 'react'

/** One side of a question: a quantity of a single product, priced only once answered. */
export default function BasketCard({ basket, state, revealed, onPick }) {
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      className={`basket ${state}`}
      onClick={onPick}
      disabled={revealed}
      aria-label={`${basket.qty} × ${basket.name}`}
    >
      <div className="basket-image">
        {failed ? (
          <span className="image-fallback">🛒</span>
        ) : (
          <img src={basket.imageUrl} alt="" onError={() => setFailed(true)} />
        )}
        <span className="basket-qty">×{basket.qty}</span>
      </div>

      <div className="basket-text">
        <span className="basket-name">{basket.name}</span>
        <span className="basket-meta">
          {[basket.manufacturer, basket.size].filter(Boolean).join(' · ')}
        </span>
        {revealed && (
          <span className="basket-total">
            ₪{basket.total.toFixed(2)}
            <span className="basket-unit">
              {' '}
              ({basket.qty} × ₪{basket.unitPrice.toFixed(2)})
            </span>
          </span>
        )}
      </div>
    </button>
  )
}
