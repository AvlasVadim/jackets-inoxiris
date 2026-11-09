/**
 * Approximate garment recolor (no ML):
 * 1) Ignore studio background + skin/hair
 * 2) Find dominant fabric chroma in the body region
 * 3) Tint pixels close to that fabric color toward beige/white/black/pink
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '..')
const SRC_DIR = path.join(ROOT, 'public', 'products')
const OUT_ROOT = path.join(SRC_DIR, 'colors')

const TARGETS = {
  beige: { r: 205, g: 178, b: 142 },
  white: { r: 232, g: 232, b: 234 },
  black: { r: 32, g: 32, b: 34 },
  pink: { r: 220, g: 118, b: 158 },
}

const MODEL_IDS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
]

function rgbToHsv(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hueDist(a, b) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function isSkin(r, g, b) {
  const { h, s, v } = rgbToHsv(r, g, b)
  // Vivid pink/red fabric is NOT skin
  if (s > 0.38 && (h >= 300 || h <= 25)) return false
  if (s > 0.55) return false

  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

  const warm =
    h >= 5 &&
    h <= 45 &&
    s >= 0.08 &&
    s <= 0.48 &&
    v >= 0.35 &&
    v <= 0.95 &&
    r > g &&
    r > b - 10

  const ycbcr =
    y > 75 &&
    y < 235 &&
    cb > 85 &&
    cb < 130 &&
    cr > 133 &&
    cr < 175 &&
    s < 0.5

  return warm || (ycbcr && r >= g)
}

function isBackground(r, g, b) {
  const { s, v } = rgbToHsv(r, g, b)
  return (v > 0.82 && s < 0.12) || (v > 0.9 && s < 0.18) || (v > 0.75 && s < 0.06)
}

function isHairLike(r, g, b, y, h) {
  const hsv = rgbToHsv(r, g, b)
  return y < h * 0.42 && hsv.v < 0.28 && hsv.s < 0.45
}

function colorDist(a, b) {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function sampleFabricKey(src, w, h, channels) {
  // Body band samples — avoid edges / head / feet
  const x0 = Math.floor(w * 0.28)
  const x1 = Math.floor(w * 0.72)
  const y0 = Math.floor(h * 0.28)
  const y1 = Math.floor(h * 0.82)
  const buckets = new Map()

  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * channels
      const r = src[i]
      const g = src[i + 1]
      const b = src[i + 2]
      if (isBackground(r, g, b) || isSkin(r, g, b) || isHairLike(r, g, b, y, h)) {
        continue
      }
      const { h: hue, s, v } = rgbToHsv(r, g, b)
      // Prefer chromatic fabric; also keep dark fabric samples
      if (!(s > 0.14 || v < 0.4)) continue
      const key = `${Math.round(hue / 12) * 12}|${Math.round(s * 8)}|${Math.round(v * 8)}`
      const prev = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, hue: 0, s: 0, v: 0 }
      prev.n += 1
      prev.r += r
      prev.g += g
      prev.b += b
      prev.hue += hue
      prev.s += s
      prev.v += v
      buckets.set(key, prev)
    }
  }

  let best = null
  for (const sample of buckets.values()) {
    if (!best || sample.n > best.n) best = sample
  }
  if (!best || best.n < 30) {
    // Fallback: vivid pink-ish default for this catalog
    return { r: 220, g: 120, b: 150, hue: 340, s: 0.45, v: 0.7, dark: false }
  }
  const n = best.n
  const r = best.r / n
  const g = best.g / n
  const b = best.b / n
  const hsv = rgbToHsv(r, g, b)
  return {
    r,
    g,
    b,
    hue: hsv.h,
    s: hsv.s,
    v: hsv.v,
    dark: hsv.v < 0.38,
  }
}

function fabricMask(r, g, b, x, y, w, h, key) {
  if (isBackground(r, g, b)) return 0
  if (isSkin(r, g, b)) return 0
  if (isHairLike(r, g, b, y, h)) return 0

  // Keep bright white tee / sneakers
  const hsv = rgbToHsv(r, g, b)
  if (hsv.v > 0.85 && hsv.s < 0.12) return 0

  const dist = colorDist({ r, g, b }, key)
  const hd = hueDist(hsv.h, key.hue)

  let score = 0
  if (key.dark) {
    // Black / charcoal garments
    if (hsv.v < 0.5 && hsv.s < 0.4 && y > h * 0.18) score = 0.85
  } else {
    if (hd < 28 && hsv.s > 0.1 && dist < 110) score = 1 - dist / 140
    else if (hd < 40 && hsv.s > 0.18 && dist < 140) score = 0.65
    // Also catch desaturated quilt stitches of same garment
    else if (hd < 35 && dist < 90 && hsv.v > 0.2 && hsv.v < 0.9) score = 0.55
  }

  // Soften near image edges (less likely clothing)
  const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / Math.min(w, h)
  if (edge < 0.04) score *= 0.15
  else if (edge < 0.08) score *= 0.55

  return Math.max(0, Math.min(1, score))
}

function recolorPixel(r, g, b, target, amount) {
  if (amount < 0.05) return [r, g, b]
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const tLum = 0.299 * target.r + 0.587 * target.g + 0.114 * target.b || 1

  // Preserve shading via luminance ratio
  let nr = (target.r / tLum) * lum
  let ng = (target.g / tLum) * lum
  let nb = (target.b / tLum) * lum

  // Extra pull for near-neutral targets
  const targetSat = rgbToHsv(target.r, target.g, target.b).s
  if (targetSat < 0.12) {
    const goal = (target.r + target.g + target.b) / 3
    const mixed = lum * (1 - 0.55 * amount) + goal * (0.55 * amount)
    nr = mixed
    ng = mixed
    nb = mixed + (target.b - target.r) * 0.25
  }

  const blend = Math.min(1, amount * 1.05)
  nr = r * (1 - blend) + nr * blend
  ng = g * (1 - blend) + ng * blend
  nb = b * (1 - blend) + nb * blend
  return [
    Math.max(0, Math.min(255, Math.round(nr))),
    Math.max(0, Math.min(255, Math.round(ng))),
    Math.max(0, Math.min(255, Math.round(nb))),
  ]
}

async function processImage(modelId) {
  const srcPath = path.join(SRC_DIR, `product-${modelId}.jpg`)
  if (!fs.existsSync(srcPath)) {
    console.warn('missing', srcPath)
    return
  }
  const outDir = path.join(OUT_ROOT, modelId)
  fs.mkdirSync(outDir, { recursive: true })

  const { data, info } = await sharp(srcPath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h, channels } = info
  const src = Buffer.from(data)
  const key = sampleFabricKey(src, w, h, channels)

  for (const [slug, target] of Object.entries(TARGETS)) {
    const out = Buffer.alloc(w * h * 3)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * channels
        const o = (y * w + x) * 3
        const r = src[i]
        const g = src[i + 1]
        const b = src[i + 2]
        const amount = fabricMask(r, g, b, x, y, w, h, key)
        const [nr, ng, nb] = recolorPixel(r, g, b, target, amount)
        out[o] = nr
        out[o + 1] = ng
        out[o + 2] = nb
      }
    }

    await sharp(out, { raw: { width: w, height: h, channels: 3 } })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(outDir, `${slug}.jpg`))
  }
  console.log(
    'ok',
    modelId,
    `fabric~ hsl(${key.hue.toFixed(0)},${key.s.toFixed(2)},${key.v.toFixed(2)})`,
  )
}

async function collageSample() {
  const modelId = '04'
  const labels = ['beige', 'white', 'black', 'pink']
  const files = labels.map((c) => path.join(OUT_ROOT, modelId, `${c}.jpg`))
  const meta = await sharp(files[0]).metadata()
  const tileW = Math.min(360, meta.width || 360)
  const tileH = Math.round(tileW * ((meta.height || 480) / (meta.width || 360)))
  const gap = 12
  const canvasW = tileW * 4 + gap * 5
  const canvasH = tileH + gap * 2

  const tiles = await Promise.all(
    files.map((f) =>
      sharp(f).resize(tileW, tileH, { fit: 'cover' }).toBuffer(),
    ),
  )

  const storeMedia = path.join(
    process.env.USERPROFILE || '',
    'AppData/Local/Cursor/AgentStores/cursor_agent_stores/bc-4b7f4e9f-2c71-4595-b297-0f40fe0e18d7/files/media/site-draft',
  )
  fs.mkdirSync(storeMedia, { recursive: true })

  await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: '#ececec',
    },
  })
    .composite(
      tiles.map((input, idx) => ({
        input,
        left: gap + idx * (tileW + gap),
        top: gap,
      })),
    )
    .png()
    .toFile(path.join(storeMedia, '27-color-variants.png'))

  console.log('collage written')
}

async function main() {
  for (const id of MODEL_IDS) await processImage(id)
  await collageSample()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
