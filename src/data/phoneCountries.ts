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

function formatByNational(national: string): string {
  const d = national.slice(0, 9)
  const a = d.slice(0, 2)
  const b = d.slice(2, 5)
  const c = d.slice(5, 7)
  const e = d.slice(7, 9)
  let out = ''
  if (a.length) {
    out += `(${a}`
    if (a.length === 2) out += ')'
  }
  if (b.length) out += `${a.length === 2 ? ' ' : ''}${b}`
  if (c.length) out += `-${c}`
  if (e.length) out += `-${e}`
  return out
}

function formatRuNational(national: string): string {
  const d = national.slice(0, 10)
  const a = d.slice(0, 3)
  const b = d.slice(3, 6)
  const c = d.slice(6, 8)
  const e = d.slice(8, 10)
  let out = ''
  if (a.length) {
    out += `(${a}`
    if (a.length === 3) out += ')'
  }
  if (b.length) out += `${a.length === 3 ? ' ' : ''}${b}`
  if (c.length) out += `-${c}`
  if (e.length) out += `-${e}`
  return out
}

/**
 * Display mask:
 * BY → +375 (00) 000-00-00
 * RU → +7 (000) 000-00-00
 * No / incomplete country → + or +digits as typed
 */
export function formatPhoneDisplay(digits: string): string {
  if (!digits) return '+'
  const country = matchPhoneCountry(digits)
  if (!country) return `+${digits}`

  const national = digits
    .slice(country.dial.length)
    .slice(0, country.nationalLength)
  const formatted =
    country.id === 'BY'
      ? formatByNational(national)
      : formatRuNational(national)

  return formatted ? `+${country.dial} ${formatted}` : `+${country.dial}`
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
