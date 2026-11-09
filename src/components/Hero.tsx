import type { Messages } from '../i18n/messages'

type Props = {
  t: Messages
}

export function Hero({ t }: Props) {
  return (
    <section className="hero" id="top" aria-label={t.brand}>
      <div className="hero-media" aria-hidden="true">
        <img
          src="/products/product-09.jpg"
          alt=""
          width={1200}
          height={1600}
          fetchPriority="high"
        />
      </div>
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-brand">
          <img
            src="/brand/inoxiris-logo-256.webp"
            srcSet="/brand/inoxiris-logo-128.webp 128w, /brand/inoxiris-logo-256.webp 256w"
            sizes="(max-width: 600px) 64px, 120px"
            alt={t.brand}
            width={120}
            height={120}
            decoding="async"
          />
          <div className="hero-brand-text">
            <strong>{t.brand}</strong>
            <span>{t.tagline}</span>
          </div>
        </div>
        <h1>{t.hero.headline}</h1>
        <p>{t.hero.sub}</p>
        <div className="cta-row">
          <a className="btn btn-accent" href="#catalog">
            {t.hero.ctaCatalog}
          </a>
          <a className="btn btn-ghost" href="#order">
            {t.hero.ctaOrder}
          </a>
        </div>
      </div>
    </section>
  )
}
