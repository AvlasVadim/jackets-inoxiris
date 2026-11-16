/**
 * Lock page scroll without a sideways jump.
 * Measure scrollbar width BEFORE locking; pad body and shrink fixed header
 * via --scrollbar-compensation. Do not combine with scrollbar-gutter: stable.
 */
export function lockBodyScroll(): () => void {
  const sbw = Math.max(0, window.innerWidth - document.documentElement.clientWidth)

  const prevHtmlOverflow = document.documentElement.style.overflow
  const prevBodyOverflow = document.body.style.overflow
  const prevBodyPaddingRight = document.body.style.paddingRight

  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'

  if (sbw > 0) {
    document.body.style.paddingRight = `${sbw}px`
    document.documentElement.style.setProperty(
      '--scrollbar-compensation',
      `${sbw}px`,
    )
  }

  return () => {
    document.documentElement.style.overflow = prevHtmlOverflow
    document.body.style.overflow = prevBodyOverflow
    document.body.style.paddingRight = prevBodyPaddingRight
    document.documentElement.style.setProperty('--scrollbar-compensation', '0px')
  }
}
