import { useEffect, useId, useState } from 'react'
import type { Messages } from '../i18n/messages'
import type { Theme } from '../hooks/useTheme'

type Props = {
  t: Messages
  theme: Theme
  onToggleTheme: () => void
}

const links = [
  { href: '#catalog', key: 'catalog' as const },
  { href: '#about', key: 'about' as const },
  { href: '#order', key: 'order' as const },
  { href: '#contacts', key: 'contacts' as const },
]

/** Scroll past this before the sticky glass bar engages. */
const STICKY_SHOW_AT = 48
/** Near top again — return to hero overlay style. */
const STICKY_HIDE_AT = 20

export function Header({ t, theme, onToggleTheme }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [sticky, setSticky] = useState(false)
  const panelId = useId()

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen)
    return () => document.body.classList.remove('menu-open')
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      setSticky((wasSticky) => {
        if (wasSticky) return y > STICKY_HIDE_AT
        return y >= STICKY_SHOW_AT
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
      <header className={`site-header ${sticky ? 'is-sticky' : ''}`}>
        <a className="brand-mark" href="#top" aria-label={t.brand}>
          <img
            src="/brand/inoxiris-logo-128.webp"
            alt=""
            width={42}
            height={42}
            decoding="async"
          />
          <span>{t.brand}</span>
        </a>

        <div className="header-actions">
          <nav className="nav nav-desktop" aria-label="Основная навигация">
            {links.map((link) => (
              <a key={link.href} href={link.href}>
                {t.nav[link.key]}
              </a>
            ))}
          </nav>

          <button
            type="button"
            className="icon-btn theme-toggle"
            data-theme-icon={theme}
            onClick={onToggleTheme}
            aria-label={
              theme === 'light'
                ? 'Включить тёмную тему'
                : 'Включить светлую тему'
            }
            title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}
          >
            <span className="theme-toggle-icons" aria-hidden="true">
              <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M12.4 2.2a.9.9 0 0 0-1.1.2 8.4 8.4 0 1 0 10.3 10.3.9.9 0 0 0-.9-1.3 6.6 6.6 0 0 1-8.3-9.2Z"
                />
              </svg>
              <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24" width="20" height="20">
                <path
                  fill="currentColor"
                  d="M12 5.2a.9.9 0 0 0 .9-.9V2.9a.9.9 0 1 0-1.8 0v1.4a.9.9 0 0 0 .9.9Zm0 13.6a.9.9 0 0 0-.9.9v1.4a.9.9 0 1 0 1.8 0v-1.4a.9.9 0 0 0-.9-.9Zm6.8-6.8h1.4a.9.9 0 1 0 0-1.8h-1.4a.9.9 0 1 0 0 1.8ZM3.8 12h1.4a.9.9 0 1 0 0-1.8H3.8a.9.9 0 1 0 0 1.8Zm13.4 5.1a.9.9 0 0 0-1.3 1.3l1 1a.9.9 0 1 0 1.3-1.3l-1-1ZM6.1 5.6l1 1A.9.9 0 1 0 8.4 5.3l-1-1A.9.9 0 0 0 6.1 5.6Zm10.3-1.3-1 1a.9.9 0 1 0 1.3 1.3l1-1a.9.9 0 0 0-1.3-1.3ZM7.1 16.4l-1 1a.9.9 0 1 0 1.3 1.3l1-1a.9.9 0 1 0-1.3-1.3ZM12 7.4A4.6 4.6 0 1 0 16.6 12 4.6 4.6 0 0 0 12 7.4Z"
                />
              </svg>
            </span>
          </button>

          <button
            type="button"
            className="icon-btn menu-toggle"
            aria-expanded={menuOpen}
            aria-controls={panelId}
            aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className={`burger ${menuOpen ? 'is-open' : ''}`} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </header>

      <div
        className={`nav-backdrop ${menuOpen ? 'is-open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      <aside
        id={panelId}
        className={`nav-drawer ${menuOpen ? 'is-open' : ''}`}
        aria-hidden={!menuOpen}
        aria-label="Меню разделов"
      >
        <button
          type="button"
          className="nav-drawer-close"
          onClick={closeMenu}
          aria-label="Закрыть меню"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14.7 5.3a1 1 0 0 1 0 1.4L10.4 11H20a1 1 0 1 1 0 2h-9.6l4.3 4.3a1 1 0 1 1-1.4 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z"
            />
          </svg>
          <span>Назад</span>
        </button>
        <nav className="nav-drawer-links">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {t.nav[link.key]}
            </a>
          ))}
        </nav>
      </aside>
    </>
  )
}
