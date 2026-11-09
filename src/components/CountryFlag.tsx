type Props = {
  code: 'BY' | 'RU'
  className?: string
}

/** Inline SVG flags — Windows often renders emoji flags as "BY"/"RU" letters. */
export function CountryFlag({ code, className }: Props) {
  if (code === 'BY') {
    return (
      <svg
        className={className}
        viewBox="0 0 36 24"
        width="22"
        height="15"
        aria-hidden="true"
      >
        <rect width="36" height="24" fill="#fff" />
        <rect width="36" height="16" y="0" fill="#c8102e" />
        <rect width="36" height="8" y="16" fill="#127455" />
        <rect width="7" height="24" fill="#fff" />
        <path
          fill="#c8102e"
          d="M1.2 3.2h1.1l.5 1.2.5-1.2h1.1l-.9.8.4 1.2-.9-.7-.9.7.4-1.2-.9-.8Zm0 5.2h1.1l.5 1.2.5-1.2h1.1l-.9.8.4 1.2-.9-.7-.9.7.4-1.2-.9-.8Zm0 5.2h1.1l.5 1.2.5-1.2h1.1l-.9.8.4 1.2-.9-.7-.9.7.4-1.2-.9-.8Zm0 5.2h1.1l.5 1.2.5-1.2h1.1l-.9.8.4 1.2-.9-.7-.9.7.4-1.2-.9-.8Z"
        />
      </svg>
    )
  }

  return (
    <svg
      className={className}
      viewBox="0 0 36 24"
      width="22"
      height="15"
      aria-hidden="true"
    >
      <rect width="36" height="8" y="0" fill="#fff" />
      <rect width="36" height="8" y="8" fill="#0039a6" />
      <rect width="36" height="8" y="16" fill="#d52b1e" />
    </svg>
  )
}
