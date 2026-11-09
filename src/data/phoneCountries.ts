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

export function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

export function matchPhoneCountry(digits: string): PhoneCountry {
  const byDial = [...phoneCountries].sort((a, b) => b.dial.length - a.dial.length)
  return byDial.find((c) => digits.startsWith(c.dial)) ?? defaultPhoneCountry
}

export type PhoneValidation = {
  ok: boolean
  country: PhoneCountry
  national: string
  message: string
}

export function validatePhone(value: string): PhoneValidation {
  const digits = digitsOnly(value)
  const country = matchPhoneCountry(digits || defaultPhoneCountry.dial)
  const national = digits.startsWith(country.dial)
    ? digits.slice(country.dial.length)
    : digits
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
