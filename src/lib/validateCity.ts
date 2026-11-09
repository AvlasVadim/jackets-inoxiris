export type CityValidation = {
  ok: boolean
  message: string
}

/** Place-name rule: letters (any script), spaces, hyphen, apostrophe. */
const CITY_NAME_RE = /^[\p{L}\s\-']+$/u
const HAS_LETTER_RE = /\p{L}/u

/**
 * City must look like a place name — not empty, not digits-only.
 * Combobox list values are preferred; free text is OK if it passes this rule.
 */
export function validateCity(value: string): CityValidation {
  const city = value.trim()

  if (!city) {
    return { ok: false, message: 'Укажите город' }
  }

  if (/^\d+$/.test(city)) {
    return {
      ok: false,
      message: 'Город не может состоять только из цифр',
    }
  }

  if (!CITY_NAME_RE.test(city) || !HAS_LETTER_RE.test(city)) {
    return { ok: false, message: 'Укажите корректное название города' }
  }

  return { ok: true, message: '' }
}
