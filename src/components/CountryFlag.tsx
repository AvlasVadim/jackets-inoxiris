type Props = {
  code: 'BY' | 'RU' | 'NONE'
  className?: string
}

/** Inline SVG flags — Windows often renders emoji flags as "BY"/"RU" letters. */
export function CountryFlag({ code, className }: Props) {
  if (code === 'NONE') {
    return (
      <svg
        className={className}
        viewBox="0 0 36 24"
        width="22"
        height="15"
        aria-hidden="true"
      >
        <rect width="36" height="24" rx="2" fill="#c4c4c4" />
        <rect
          x="1"
          y="1"
          width="34"
          height="22"
          rx="1.5"
          fill="none"
          stroke="#9a9a9a"
          strokeWidth="1.5"
        />
        <path
          d="M10 16 L18 8 L26 16"
          fill="none"
          stroke="#8a8a8a"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="22" cy="10" r="1.4" fill="#8a8a8a" />
      </svg>
    )
  }

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
