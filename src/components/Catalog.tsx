import { useState } from 'react'
import { products } from '../data/products'
import type { Messages } from '../i18n/messages'
import { ProductLightbox } from './ProductLightbox'

type Props = {
  t: Messages
  onOrderModel: (modelName: string) => void
  onOrderFromLightbox: (payload: {
    model: string
    color: string
    size: string
  }) => void
}

export function Catalog({ t, onOrderModel, onOrderFromLightbox }: Props) {
  const [lightbox, setLightbox] = useState<{
    src: string
    alt: string
    modelId: string
    model: string
  } | null>(null)

  return (
    <section className="section" id="catalog">
      <div className="section-head">
        <h2>{t.catalog.title}</h2>
        <p>{t.catalog.lead}</p>
      </div>
      <div className="catalog-grid">
        {products.map((product, index) => (
          <article
            className="product"
            key={product.id}
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <button
              type="button"
              className="product-media product-media-btn"
              onClick={() =>
                setLightbox({
                  src: product.image,
                  alt: product.name,
                  modelId: product.id,
                  model: product.name,
                })
              }
              aria-label={`Открыть фото: ${product.name}`}
            >
              <img
                src={product.image}
                alt={product.name}
                width={480}
                height={600}
                loading="lazy"
              />
            </button>
            <h3>{product.name}</h3>
            <p>{product.blurb}</p>
            <div className="product-meta">
              <span>{t.catalog.sizes}</span>
              <span>{t.catalog.leadTime}</span>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => onOrderModel(product.name)}
            >
              {t.catalog.orderThis}
            </button>
          </article>
        ))}
      </div>

      <ProductLightbox
        open={Boolean(lightbox)}
        src={lightbox?.src ?? ''}
        alt={lightbox?.alt ?? ''}
        modelId={lightbox?.modelId ?? ''}
        modelName={lightbox?.model ?? ''}
        onClose={() => setLightbox(null)}
        onOrder={(payload) => {
          setLightbox(null)
          onOrderFromLightbox(payload)
        }}
      />
    </section>
  )
}
