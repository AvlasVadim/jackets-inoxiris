/** Photo variant slugs under /products/colors/{modelId}/{slug}.jpg */
export const PRODUCT_COLOR_VARIANTS = [
  'beige',
  'white',
  'black',
  'pink',
] as const

export type ProductColorSlug = (typeof PRODUCT_COLOR_VARIANTS)[number]

export type ProductColorSwatch = {
  slug: ProductColorSlug
  label: string
  hex: string
}

/** Display meta for swatches (RU label stays the order / Telegram key). */
export const COLOR_SLUG_META: Record<
  ProductColorSlug,
  { label: string; hex: string }
> = {
  beige: { label: 'Бежевый', hex: '#cbb896' },
  white: { label: 'Белый', hex: '#f4f2ef' },
  black: { label: 'Чёрный', hex: '#1c1c1c' },
  pink: { label: 'Розовый', hex: '#e59bb0' },
}

/** RU form labels → photo slug (only these get a photo swap / Telegram sendPhoto). */
export const COLOR_LABEL_TO_SLUG: Record<string, ProductColorSlug> = {
  Бежевый: 'beige',
  Белый: 'white',
  Чёрный: 'black',
  Черный: 'black',
  Розовый: 'pink',
}

/**
 * Per-model available photo colors. Omit a slug to hide that swatch
 * even if a file exists under /products/colors/{id}/.
 */
export const MODEL_COLOR_VARIANTS: Record<string, readonly ProductColorSlug[]> =
  {
    '01': ['beige', 'white', 'black', 'pink'],
    '02': ['beige', 'white', 'black', 'pink'],
    '03': ['beige', 'white', 'black', 'pink'],
    '04': ['beige', 'white', 'black', 'pink'],
    '05': ['beige', 'white', 'black'],
    '06': ['beige', 'white', 'pink'],
    '07': ['beige', 'white', 'black', 'pink'],
    '08': ['beige', 'white', 'black', 'pink'],
    '09': ['black', 'beige', 'white'],
    '10': ['pink', 'beige', 'white', 'black'],
    '11': ['beige', 'white', 'black', 'pink'],
  }

export function colorLabelToSlug(label: string): ProductColorSlug | null {
  const key = label.trim()
  if (!key || key.toLowerCase() === 'любой') return null
  const direct = COLOR_LABEL_TO_SLUG[key]
  if (direct) return direct
  const found = Object.entries(COLOR_LABEL_TO_SLUG).find(
    ([ru]) => ru.toLowerCase() === key.toLowerCase(),
  )
  return found ? found[1] : null
}

export function getModelColorSwatches(modelId: string): ProductColorSwatch[] {
  const variants = MODEL_COLOR_VARIANTS[modelId] ?? PRODUCT_COLOR_VARIANTS
  return variants.map((slug) => ({
    slug,
    label: COLOR_SLUG_META[slug].label,
    hex: COLOR_SLUG_META[slug].hex,
  }))
}

export function productColorImagePath(
  modelId: string,
  slug: ProductColorSlug,
): string {
  return `/products/colors/${modelId}/${slug}.jpg`
}

export function resolveProductColorImage(
  modelId: string,
  colorLabel: string,
  fallbackImage: string,
): string {
  const slug = colorLabelToSlug(colorLabel)
  if (!slug) return fallbackImage
  const available = MODEL_COLOR_VARIANTS[modelId] ?? PRODUCT_COLOR_VARIANTS
  if (!available.includes(slug)) return fallbackImage
  return productColorImagePath(modelId, slug)
}
