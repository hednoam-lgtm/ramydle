import { useState } from 'react'

export default function ProductCard({ product }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="product-card">
      <div className="product-image">
        {failed ? (
          <span className="image-fallback">🛒</span>
        ) : (
          <img src={product.imageUrl} alt={product.name} onError={() => setFailed(true)} />
        )}
      </div>
      <h2 className="product-name">{product.name}</h2>
      <p className="product-meta">
        {[product.manufacturer, product.size].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}
