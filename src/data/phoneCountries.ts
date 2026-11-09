export type PhoneCountry = {
  id: 'BY' | 'RU'
  label: string
  /** Genitive for phrases like «Для Беларуси нужно…» */
  labelGenitive: string
  dial: string
  /** National subscriber digits after the country code (no carrier check). */
  nationalLength: number
}

export const phoneCountries: PhoneCountry[] = [
  {
    id: 'BY',
    label: 'Беларусь',
    labelGenitive: 'Беларуси',
    dial: '375',
    nationalLength: 9,
  },
  {
    id: 'RU',
    label: 'Россия',
    labelGenitive: 'России',
    dial: '7',
    nationalLength: 10,
  },
]

export const defaultPhoneCountry = phoneCountries[0]

export const UNSUPPORTED_COUNTRY_MESSAGE = 'Данная страна не поддерживается'
export const SELECT_COUNTRY_LABEL = 'Выберите страну'

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

/** Longest dial first so 375 wins over a lone leading digit. */
const dialsLongestFirst = [...phoneCountries].sort(
  (a, b) => b.dial.length - a.dial.length,
)

/**
 * Exact country match only when digits start with a supported dial (375 / 7).
 * Does not fall back to BY — unknown / incomplete codes stay unmatched.
 */
export function matchPhoneCountry(digits: string): PhoneCountry | null {
  if (!digits) return null
  return dialsLongestFirst.find((c) => digits.startsWith(c.dial)) ?? null
}

/** National part of the visible mask; `X` = digit slot. */
export function phoneNationalTemplate(country: PhoneCountry): string {
  return country.id === 'BY' ? '(XX) XXX-XX-XX' : '(XXX) XXX-XX-XX'
}

/**
 * Full editor string with placeholders:
 * BY → +375 (XX) XXX-XX-XX
 * RU → +7 (XXX) XXX-XX-XX
 * Typed digits replace X; punctuation always stays.
 * Without a matched country → + / +digits as typed.
 */
export function formatPhoneGhost(digits: string): string {
  if (!digits) return '+'
  const country = matchPhoneCountry(digits)
  if (!country) return `+${digits}`

  const national = digits
    .slice(country.dial.length)
    .slice(0, country.nationalLength)
  let ni = 0
  let out = `+${country.dial} `
  for (const ch of phoneNationalTemplate(country)) {
    if (ch === 'X') {
      out += ni < national.length ? national[ni++] : 'X'
    } else {
      out += ch
    }
  }
  return out
}

/** Filled display only (no X) — Telegram / summary. */
export function formatPhoneDisplay(digits: string): string {
  const ghost = formatPhoneGhost(digits)
  const x = ghost.indexOf('X')
  if (x < 0) return ghost
  return (
    ghost
      .slice(0, x)
      .replace(/[\s-]+$/g, '')
      .replace(/\($/g, '')
      .trimEnd() || '+'
  )
}

/** How many digits are strictly before `caret` in a ghost/display string. */
export function digitIndexFromCaret(text: string, caret: number): number {
  let count = 0
  const lim = Math.max(0, Math.min(caret, text.length))
  for (let i = 0; i < lim; i++) {
    if (/\d/.test(text[i]!)) count++
  }
  return count
}

/** Caret position just after the N-th digit (N = digitIndex). 0 → after '+'. */
export function caretFromDigitIndex(text: string, digitIndex: number): number {
  if (digitIndex <= 0) {
    const plus = text.indexOf('+')
    return plus >= 0 ? plus + 1 : 0
  }
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]!)) {
      seen++
      if (seen === digitIndex) return i + 1
    }
  }
  let last = text.indexOf('+') + 1
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]!)) last = i + 1
  }
  return last
}

/** Normalize any input to +digits (or "+") for parent state / Telegram. */
export function toE164(value: string): string {
  const digits = digitsOnly(value)
  return digits ? `+${digits}` : '+'
}

export type PhoneValidation = {
  ok: boolean
  country: PhoneCountry | null
  national: string
  message: string
}

export function validatePhone(value: string): PhoneValidation {
  const digits = digitsOnly(value)

  if (!digits) {
    return {
      ok: false,
      country: null,
      national: '',
      message: 'Укажите номер телефона',
    }
  }

  const country = matchPhoneCountry(digits)

  if (!country) {
    return {
      ok: false,
      country: null,
      national: '',
      message: UNSUPPORTED_COUNTRY_MESSAGE,
    }
  }

  const national = digits.slice(country.dial.length)
  const expected = country.nationalLength

  if (!national.length) {
    return {
      ok: false,
      country,
      national,
      message: `Укажите номер: +${country.dial} и ${expected} цифр`,
    }
  }

  if (national.length < expected) {
    return {
      ok: false,
      country,
      national,
      message: `Для ${country.labelGenitive} нужно ${expected} цифр после +${country.dial} (сейчас ${national.length})`,
    }
  }

  if (national.length > expected) {
    return {
      ok: false,
      country,
      national,
      message: `Для ${country.labelGenitive} максимум ${expected} цифр после +${country.dial} (сейчас ${national.length})`,
    }
  }

  return { ok: true, country, national, message: '' }
}
