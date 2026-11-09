import { useEffect, useId, useRef, useState } from 'react'
import {
  digitsOnly,
  formatPhoneDisplay,
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
  const [open, setOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const { mounted, visible } = useFlyout(open)
  const digits = digitsOnly(value)
  const country = matchPhoneCountry(digits)
  const display = formatPhoneDisplay(digits)
  const validation = validatePhone(value)
  const revealError = showError || touched
  const errorMessage = revealError && !validation.ok ? validation.message : ''
  const flagCode = country?.id ?? 'NONE'
  const flagLabel = country
    ? `${country.id}, ${country.label}`
    : SELECT_COUNTRY_LABEL

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

  function emitDigits(nextDigits: string) {
    onChange(toE164(nextDigits))
  }

  function selectCountry(next: PhoneCountry) {
    const local = country
      ? digits.startsWith(country.dial)
        ? digits.slice(country.dial.length)
        : ''
      : ''
    const clipped = local.slice(0, next.nationalLength)
    emitDigits(`${next.dial}${clipped}`)
    setOpen(false)
    setTouched(true)
    queueMicrotask(() => inputRef.current?.focus())
  }

  function onInput(raw: string) {
    let next = digitsOnly(raw)
    const matched = matchPhoneCountry(next)
    if (matched) {
      const national = next
        .slice(matched.dial.length)
        .slice(0, matched.nationalLength)
      next = `${matched.dial}${national}`
    }
    emitDigits(next)
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
        <input
          ref={inputRef}
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          value={display}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? 'phone-error' : undefined}
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => {
            if (
              (e.key === 'Backspace' || e.key === 'Delete') &&
              display === '+'
            ) {
              e.preventDefault()
            }
          }}
        />
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
                  emitDigits('')
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
