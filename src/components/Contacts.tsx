import type { Messages } from '../i18n/messages'

type Props = {
  t: Messages
}

export function Contacts({ t }: Props) {
  return (
    <section className="section" id="contacts">
      <div className="section-head">
        <h2>{t.contacts.title}</h2>
      </div>
      <ul className="contacts-list">
        <li>
          <strong>{t.contacts.city}</strong>
          <span>{t.contacts.shipping}</span>
        </li>
        <li>
          <strong>{t.contacts.instagram}</strong>
          <a
            href="https://www.instagram.com/inoxirisby2024"
            target="_blank"
            rel="noreferrer"
          >
            @inoxirisby2024
          </a>
        </li>
        <li>
          <strong>{t.contacts.phone}</strong>
          <span>{t.contacts.phonePlaceholder}</span>
        </li>
        <li>
          <strong>{t.contacts.email}</strong>
          <span>{t.contacts.emailPlaceholder}</span>
        </li>
      </ul>
    </section>
  )
}
