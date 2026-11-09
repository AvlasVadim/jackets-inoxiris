import type { Messages } from '../i18n/messages'

type Props = {
  t: Messages
}

export function About({ t }: Props) {
  return (
    <section className="section" id="about">
      <div className="section-head">
        <h2>{t.about.title}</h2>
      </div>
      <div className="about-panel">
        <p>{t.about.p1}</p>
        <p>{t.about.p2}</p>
      </div>
    </section>
  )
}
