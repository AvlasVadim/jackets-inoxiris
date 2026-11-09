import { useEffect, useId, useRef, useState } from 'react'
import {
  defaultPhoneCountry,
  digitsOnly,
  matchPhoneCountry,
  phoneCountries,
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

function toDisplay(digits: string) {
  return digits ? `+${digits}` : '+'
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
  const country = matchPhoneCountry(digits || defaultPhoneCountry.dial)
  const display = toDisplay(digits || '')
  const validation = validatePhone(value)
  const revealError = showError || touched
  const errorMessage = revealError && !validation.ok ? validation.message : ''

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    // Don't mark dial-only prefix as invalid until the user interacts / submit fails
    inputRef.current?.setCustomValidity(
      revealError && !validation.ok ? validation.message : '',
    )
  }, [revealError, validation.ok, validation.message])

  function setFromDigits(nextDigits: string) {
    onChange(toDisplay(nextDigits))
  }

  function selectCountry(next: PhoneCountry) {
    const local = digits.startsWith(country.dial)
      ? digits.slice(country.dial.length)
      : digits.replace(/^(375|7)/, '')
    const clipped = local.slice(0, next.nationalLength)
    setFromDigits(`${next.dial}${clipped}`)
    setOpen(false)
    setTouched(true)
  }

  function onInput(raw: string) {
    let next = digitsOnly(raw)
    const matched = matchPhoneCountry(next || defaultPhoneCountry.dial)
    if (next.startsWith(matched.dial)) {
      const national = next.slice(matched.dial.length).slice(0, matched.nationalLength)
      next = `${matched.dial}${national}`
    }
    setFromDigits(next)
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
          aria-label={`${country.id}, ${country.label}`}
          onClick={() => setOpen((v) => !v)}
        >
          <CountryFlag code={country.id} className="phone-flag-icon" />
          <span className="phone-flag-code">{country.id}</span>
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
            {phoneCountries.map((item) => (
              <li key={item.id} role="option" aria-selected={item.id === country.id}>
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
