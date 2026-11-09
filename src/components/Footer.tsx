const socials = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://www.instagram.com/inoxirisby2024',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
        <path
          fill="currentColor"
          d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.75A3.75 3.75 0 0 0 3.75 7.5v9A3.75 3.75 0 0 0 7.5 20.25h9A3.75 3.75 0 0 0 20.25 16.5v-9A3.75 3.75 0 0 0 16.5 3.75h-9Zm10.13 1.37a1.13 1.13 0 1 1 0 2.25 1.13 1.13 0 0 1 0-2.25ZM12 7.25A4.75 4.75 0 1 1 7.25 12 4.75 4.75 0 0 1 12 7.25Zm0 1.75A3 3 0 1 0 15 12a3 3 0 0 0-3-3Z"
        />
      </svg>
    ),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: 'https://t.me/inoxiris_by',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
        <path
          fill="currentColor"
          d="M21.7 4.27a1.4 1.4 0 0 0-1.45-.2L3.4 10.7c-.9.37-.88 1.66.04 1.98l4.2 1.45 1.62 5.05c.26.8 1.28 1.03 1.86.42l2.4-2.52 4.4 3.24c.7.52 1.7.13 1.9-.73L22.1 5.6c.14-.57-.1-1.16-.4-1.33ZM9.2 13.7l8.7-5.5c.22-.14.45.16.26.34l-7.1 6.7-.28 3.02-1.58-4.56Z"
        />
      </svg>
    ),
  },
  {
    id: 'vk',
    label: 'VK (ссылка уточняется)',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
        <path
          fill="currentColor"
          d="M15.07 17.5h1.72c.5 0 .74-.32.55-.78-.18-.43-1.94-2.2-1.94-2.2-.18-.2-.14-.3.08-.53 1.23-1.4 2.23-3.02 2.6-4.02.12-.33.02-.55-.36-.55h-1.9c-.34 0-.5.18-.58.42-.54 1.38-1.4 2.86-2.05 2.86-.32 0-.4-.24-.4-.72V8.75c0-.5-.14-.72-.58-.72H9.8c-.3 0-.48.16-.48.4 0 .42.62.52.68 1.7v2.56c0 .56-.1.74-.32.74-.74 0-2.03-1.82-2.84-4.14-.16-.45-.32-.62-.67-.62H4.2c-.36 0-.44.18-.44.42 0 .4.54 2.48 2.55 5.22 1.34 1.84 3.22 2.82 4.94 2.82 1.02 0 1.15-.24 1.15-.64v-1.48c0-.47.1-.56.44-.56.32 0 .86.16 2.12 1.4.9.9 1.05 1.3 1.55 1.3Z"
        />
      </svg>
    ),
  },
  {
    id: 'x',
    label: 'X (ссылка уточняется)',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
        <path
          fill="currentColor"
          d="M17.6 3h2.7l-5.9 6.7L22 21h-6.2l-4.3-5.6L6.3 21H3.6l6.3-7.2L2 3h6.4l3.9 5.2L17.6 3Zm-1 16.2h1.5L7.5 4.7H5.9l10.7 14.5Z"
        />
      </svg>
    ),
  },
] as const

type Props = {
  rights: string
}

export function Footer({ rights }: Props) {
  return (
    <footer className="site-footer">
      <span>{rights}</span>
      <ul className="social-row" aria-label="Соцсети">
        {socials.map((item) => (
          <li key={item.id}>
            <a
              className="social-link"
              href={item.href}
              aria-label={item.label}
              {...(item.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {item.icon}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  )
}
