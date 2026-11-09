import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  caretFromDigitIndex,
  digitIndexFromCaret,
  digitsOnly,
  formatPhoneDisplay,
  formatPhoneGhost,
  matchPhoneCountry,
  phoneCountries,
  SELECT_COUNTRY_LABEL,
  toE164,
  validatePhone,
  type PhoneCountry,
} from '../data/phoneCountries'
import { useFlyout } from '../hooks/useFlyout'
import { CountryFlag } from './CountryFlag'

type Props = {
  label: string
  value: string
  required?: boolean
  showError?: boolean
  onChange: (e164: string) => void
}

function clipDigits(rawDigits: string): string {
  let next = digitsOnly(rawDigits)
  const matched = matchPhoneCountry(next)
  if (matched) {
    const national = next
      .slice(matched.dial.length)
      .slice(0, matched.nationalLength)
    next = `${matched.dial}${national}`
  }
  return next
}

export function PhoneField({
  label,
  value,
  required,
  showError = false,
  onChange,
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const digitsRef = useRef('')
  const pendingCaretDigit = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const { mounted, visible } = useFlyout(open)
  const digits = digitsOnly(value)
  digitsRef.current = digits
  const country = matchPhoneCountry(digits)
  /** Typed portion only — no X in the real input value. */
  const display = formatPhoneDisplay(digits)
  /** Full template for the underlay (X placeholders). */
  const ghost = formatPhoneGhost(digits)
  const validation = validatePhone(value)
  const revealError = showError || touched
  const errorMessage = revealError && !validation.ok ? validation.message : ''
  const flagCode = country?.id ?? 'NONE'
  const flagLabel = country
    ? `${country.id}, ${country.label}`
    : SELECT_COUNTRY_LABEL
  const showGhostMask = Boolean(country)

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    inputRef.current?.setCustomValidity(
      revealError && !validation.ok ? validation.message : '',
    )
  }, [revealError, validation.ok, validation.message])

  useLayoutEffect(() => {
    if (pendingCaretDigit.current == null || !inputRef.current) return
    const pos = caretFromDigitIndex(display, pendingCaretDigit.current)
    inputRef.current.setSelectionRange(pos, pos)
    pendingCaretDigit.current = null
  }, [display])

  function emitDigits(nextDigits: string, caretDigitIndex?: number) {
    if (caretDigitIndex != null) pendingCaretDigit.current = caretDigitIndex
    digitsRef.current = nextDigits
    onChange(toE164(nextDigits))
  }

  function selectCountry(next: PhoneCountry) {
    const local = country
      ? digitsRef.current.startsWith(country.dial)
        ? digitsRef.current.slice(country.dial.length)
        : ''
      : ''
    const clipped = local.slice(0, next.nationalLength)
    const nextDigits = `${next.dial}${clipped}`
    emitDigits(nextDigits, nextDigits.length)
    setOpen(false)
    setTouched(true)
    queueMicrotask(() => inputRef.current?.focus())
  }

  function onInput(raw: string) {
    const el = inputRef.current
    const caret = el?.selectionStart ?? raw.length
    const caretDigits = digitIndexFromCaret(raw, caret)
    emitDigits(clipDigits(raw), caretDigits)
  }

  function deleteDigitAt(index: number) {
    const current = digitsRef.current
    if (index < 0 || index >= current.length) return

    // Keep the country dial intact while national digits remain — otherwise
    // backspace after ")" eats "5" from 375 and the mask collapses to raw
    // digits like +371234567.
    let removeAt = index
    const matched = matchPhoneCountry(current)
    if (matched && current.length > matched.dial.length) {
      if (removeAt < matched.dial.length) {
        removeAt = matched.dial.length // first national digit
      }
    }

    const next = current.slice(0, removeAt) + current.slice(removeAt + 1)
    emitDigits(next, removeAt)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const el = inputRef.current
    if (!el) return

    if (e.key !== 'Backspace' && e.key !== 'Delete') return

    e.preventDefault()
    e.stopPropagation()

    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const current = digitsRef.current

    if (display === '+' || current === '') return

    if (start !== end) {
      const dStart = digitIndexFromCaret(display, start)
      const dEnd = digitIndexFromCaret(display, end)
      emitDigits(current.slice(0, dStart) + current.slice(dEnd), dStart)
      return
    }

    if (e.key === 'Backspace') {
      // Skip brackets / spaces / dashes — always remove a real digit.
      let i = start - 1
      while (i >= 0 && !/\d/.test(display[i]!)) i--
      if (i < 0) {
        if (current.length) deleteDigitAt(current.length - 1)
        return
      }
      deleteDigitAt(digitIndexFromCaret(display, i))
      return
    }

    // Delete (forward): skip punctuation, remove next digit.
    let i = start
    while (i < display.length && !/\d/.test(display[i]!)) i++
    if (i >= display.length) return
    deleteDigitAt(digitIndexFromCaret(display, i))
  }

  return (
    <div className={`field phone-field ${errorMessage ? 'is-invalid' : ''}`} ref={rootRef}>
      <label htmlFor="phone">{label}</label>
      <div className={`phone-shell ${errorMessage ? 'is-invalid' : ''}`}>
        <button
          type="button"
          className="phone-flag"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={flagLabel}
          onClick={() => setOpen((v) => !v)}
        >
          <CountryFlag code={flagCode} className="phone-flag-icon" />
          <span className="phone-flag-code">
            {country?.id ?? '—'}
          </span>
          <span aria-hidden="true">▾</span>
        </button>
        <div className="phone-input-slot">
          {showGhostMask ? (
            <div className="phone-mask" aria-hidden="true">
              {[...ghost].map((ch, i) => (
                <span
                  key={`${i}-${ch}`}
                  className={ch === 'X' ? 'phone-mask-x' : 'phone-mask-ch'}
                >
                  {ch}
                </span>
              ))}
            </div>
          ) : null}
          <input
            ref={inputRef}
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required={required}
            value={display}
            className={showGhostMask ? 'phone-input-ghosted' : undefined}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'phone-error' : undefined}
            onChange={(e) => onInput(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={onKeyDown}
          />
        </div>
        {mounted ? (
          <ul
            id={listId}
            className={`phone-country-list menu-flyout${visible ? ' is-open' : ''}`}
            role="listbox"
          >
            <li role="option" aria-selected={!country}>
              <button
                type="button"
                className="phone-country-unknown"
                onClick={() => {
                  emitDigits('', 0)
                  setOpen(false)
                  setTouched(true)
                  queueMicrotask(() => inputRef.current?.focus())
                }}
              >
                <CountryFlag code="NONE" className="phone-flag-icon" />
                <span>{SELECT_COUNTRY_LABEL}</span>
              </button>
            </li>
            {phoneCountries.map((item) => (
              <li key={item.id} role="option" aria-selected={item.id === country?.id}>
                <button type="button" onClick={() => selectCountry(item)}>
                  <CountryFlag code={item.id} className="phone-flag-icon" />
                  <span>
                    {item.label} (+{item.dial})
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {errorMessage ? (
        <p id="phone-error" className="field-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
