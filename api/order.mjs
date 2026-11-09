/**
 * Vercel serverless order endpoint (plain ESM, no TS / no shared imports).
 * Vite local middleware stays in server/telegramOrderPlugin.ts
 * (+ shared anti-spam helpers in server/orderAntiSpam.ts — mirrored below).
 *
 * Photos: never trust ephemeral VERCEL_URL for Telegram (SSO/Dashboard HTML).
 * Use PUBLIC_SITE_URL / production alias, fetch the jpg here, multipart upload.
 *
 * Anti-spam (no database):
 * - Honeypot fields `website` / `company` — if filled, soft 200, no Telegram.
 * - In-memory IP rate limit (x-forwarded-for / x-real-ip): 5 req / 10 min.
 *   Map is per serverless instance — good enough for Hobby; not cluster-wide.
 */

const HONEYPOT_FIELDS = ['website', 'company']
const ORDER_RATE_LIMIT_MAX = 5
const ORDER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const ORDER_RATE_LIMIT_MESSAGE =
  'Слишком много заявок с вашего адреса. Подождите около 10 минут и попробуйте снова.'

/** @type {Map<string, number[]>} */
const hitsByIp = new Map()

function isHoneypotFilled(body) {
  if (!body || typeof body !== 'object') return false
  for (const key of HONEYPOT_FIELDS) {
    const value = body[key]
    if (typeof value === 'string' && value.trim() !== '') return true
    if (typeof value === 'number' && Number.isFinite(value)) return true
    if (typeof value === 'boolean' && value) return true
  }
  return false
}

function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff && xff.trim()) return xff.split(',')[0].trim() || 'unknown'
  const real = request.headers.get('x-real-ip')
  if (real && real.trim()) return real.trim()
  return 'unknown'
}

function checkOrderRateLimit(ip) {
  const key = (ip || 'unknown').trim() || 'unknown'
  const now = Date.now()
  const cutoff = now - ORDER_RATE_LIMIT_WINDOW_MS
  let hits = hitsByIp.get(key) || []
  hits = hits.filter((t) => t > cutoff)
  if (hits.length >= ORDER_RATE_LIMIT_MAX) {
    hitsByIp.set(key, hits)
    const oldest = hits[0] ?? now
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + ORDER_RATE_LIMIT_WINDOW_MS - now) / 1000),
    )
    return { ok: false, retryAfterSec }
  }
  hits.push(now)
  hitsByIp.set(key, hits)
  if (hitsByIp.size > 2000) {
    for (const [k, bucket] of hitsByIp) {
      const kept = bucket.filter((t) => t > cutoff)
      if (kept.length === 0) hitsByIp.delete(k)
      else hitsByIp.set(k, kept)
    }
  }
  return { ok: true }
}

const ORDER_KB = {
  inline_keyboard: [
    [
      { text: '✅ Одобрить', callback_data: 'ord:ok' },
      { text: '❌ Отклонить', callback_data: 'ord:no' },
    ],
  ],
}

/** Canonical production site — Telegram must fetch from a public alias, not deploy URL. */
const DEFAULT_PUBLIC_SITE = 'https://jackets-inoxiris.vercel.app'

const PRODUCT_IDS = {
  'модель 1': '01',
  'модель 2': '02',
  'модель 3': '03',
  'модель 4': '04',
  hygge: '05',
  duoform: '06',
  'модель 7': '07',
  linda: '08',
  'модель 9': '09',
  'модель 10': '10',
  'модель 11': '11',
}

const COLOR_LABEL_TO_SLUG = {
  Бежевый: 'beige',
  Белый: 'white',
  Чёрный: 'black',
  Черный: 'black',
  Розовый: 'pink',
}

function json(status, payload, extraHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders || {}),
    },
  })
}

/** Place-name rule: letters, spaces, hyphen, apostrophe — not empty / digits-only. */
function validateCity(value) {
  const city = String(value || '').trim()
  if (!city) {
    return { ok: false, message: 'Укажите город' }
  }
  if (/^\d+$/.test(city)) {
    return {
      ok: false,
      message: 'Город не может состоять только из цифр',
    }
  }
  if (!/^[\p{L}\s\-']+$/u.test(city) || !/\p{L}/u.test(city)) {
    return { ok: false, message: 'Укажите корректное название города' }
  }
  return { ok: true, message: '' }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatNow() {
  return new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Minsk',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function buildDigest(body) {
  const row = (emoji, label, value) =>
    `${emoji} <b>${label}:</b> ${escapeHtml(value || '—')}`
  return [
    '🆕 <b>Заявка InOxiris</b>',
    '',
    '📦 <b>Товар</b>',
    '────────',
    row('👗', 'Модель', body.model),
    row('📏', 'Рост / размер', body.size),
    row('🎨', 'Цвет', body.color),
    '',
    '👤 <b>Клиент</b>',
    '────────',
    row('✍️', 'Имя', body.name),
    row('📞', 'Телефон', body.phone),
    row('🏙', 'Город', body.city),
    row('💬', 'Комментарий', body.comment),
    row('🕒', 'Время', formatNow()),
  ].join('\n')
}

function colorLabelToSlug(label) {
  const key = String(label || '').trim()
  if (!key || key.toLowerCase() === 'любой') return null
  if (COLOR_LABEL_TO_SLUG[key]) return COLOR_LABEL_TO_SLUG[key]
  const found = Object.entries(COLOR_LABEL_TO_SLUG).find(
    ([ru]) => ru.toLowerCase() === key.toLowerCase(),
  )
  return found ? found[1] : null
}

function resolveProductId(modelName) {
  const key = String(modelName || '').trim().toLowerCase()
  if (PRODUCT_IDS[key]) return PRODUCT_IDS[key]
  const match = key.match(/^модель\s*(\d{1,2})$/)
  if (match) return match[1].padStart(2, '0')
  return null
}

/**
 * Prefer explicit PUBLIC_SITE_URL, then Vercel production alias.
 * Do NOT use VERCEL_URL — that is the ephemeral deployment host and often
 * returns Vercel SSO/Dashboard HTML to Telegram's image crawler.
 */
function publicBaseUrl() {
  const fromEnv = String(
    process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '',
  ).trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const production = String(
    process.env.VERCEL_PROJECT_PRODUCTION_URL || '',
  ).trim()
  if (production) {
    return `https://${production.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  }

  return DEFAULT_PUBLIC_SITE
}

function resolvePhotoUrl(baseUrl, model, color) {
  if (!baseUrl) return null
  const slug = colorLabelToSlug(color)
  const id = resolveProductId(model)
  if (!slug || !id) return null
  return `${baseUrl.replace(/\/$/, '')}/products/colors/${id}/${slug}.jpg`
}

function readEnv() {
  return {
    token: String(process.env.TELEGRAM_BOT_TOKEN || '').trim(),
    chatId: String(process.env.TELEGRAM_CHAT_ID || '-1003739761141').trim(),
    threadId: String(process.env.TELEGRAM_MESSAGE_THREAD_ID || '2').trim(),
  }
}

function telegramSafeError(body) {
  if (!body || typeof body !== 'object') return 'unknown Telegram error'
  return body.description || JSON.stringify(body)
}

function isThreadError(body) {
  const err = telegramSafeError(body).toLowerCase()
  return (
    err.includes('thread') ||
    err.includes('topic') ||
    err.includes('message_thread_id')
  )
}

async function tgApi(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(body.ok),
    status: res.status,
    body,
  }
}

/** Download product jpg from the public site; reject non-image (SSO HTML, etc.). */
async function fetchProductPhoto(photoUrl) {
  const res = await fetch(photoUrl, {
    redirect: 'follow',
    headers: { Accept: 'image/jpeg,image/*,*/*' },
  })
  if (!res.ok) {
    throw new Error(`photo fetch HTTP ${res.status} for ${photoUrl}`)
  }
  const contentType = String(res.headers.get('content-type') || '').toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error(
      `photo URL returned ${contentType || 'unknown'} (expected image) for ${photoUrl}`,
    )
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength < 1000) {
    throw new Error(`photo too small (${bytes.byteLength}B) for ${photoUrl}`)
  }
  const name = photoUrl.split('/').pop() || 'product.jpg'
  return { bytes, contentType: contentType.split(';')[0] || 'image/jpeg', name }
}

async function sendTelegramPhotoMultipart(opts) {
  const form = new FormData()
  form.append('chat_id', opts.chatId)
  form.append('caption', opts.caption)
  form.append('parse_mode', 'HTML')
  form.append('reply_markup', JSON.stringify(ORDER_KB))
  if (opts.threadId) form.append('message_thread_id', opts.threadId)
  form.append(
    'photo',
    new Blob([opts.bytes], { type: opts.contentType }),
    opts.name,
  )

  const res = await fetch(
    `https://api.telegram.org/bot${opts.token}/sendPhoto`,
    { method: 'POST', body: form },
  )
  const body = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(body.ok),
    status: res.status,
    body,
    mode: 'photo',
    usedThread: Boolean(opts.threadId),
  }
}

async function sendTelegramMessage(opts) {
  const payload = {
    chat_id: opts.chatId,
    text: opts.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: ORDER_KB,
  }
  if (opts.threadId) payload.message_thread_id = Number(opts.threadId)
  const result = await tgApi(opts.token, 'sendMessage', payload)
  return {
    ...result,
    mode: 'text',
    usedThread: Boolean(opts.threadId),
  }
}

async function deliver({ token, chatId, threadId, text, photoUrl }) {
  if (photoUrl) {
    const photo = await fetchProductPhoto(photoUrl)
    return sendTelegramPhotoMultipart({
      token,
      chatId,
      threadId,
      caption: text,
      bytes: photo.bytes,
      contentType: photo.contentType,
      name: photo.name,
    })
  }
  return sendTelegramMessage({ token, chatId, threadId, text })
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    try {
      const ip = clientIp(request)
      const rate = checkOrderRateLimit(ip)
      if (!rate.ok) {
        return json(
          429,
          { ok: false, error: ORDER_RATE_LIMIT_MESSAGE },
          { 'Retry-After': String(rate.retryAfterSec) },
        )
      }

      let body
      try {
        body = await request.json()
      } catch {
        return json(400, { ok: false, error: 'Invalid JSON body' })
      }

      if (isHoneypotFilled(body)) {
        console.warn('[order] honeypot filled — soft reject, no Telegram')
        // Soft success so bots do not retry; nothing is sent to Telegram.
        return json(200, { ok: true, mode: 'text', usedThread: false })
      }

      const { token, chatId, threadId } = readEnv()
      if (!token || !chatId) {
        const missing = [
          !token ? 'TELEGRAM_BOT_TOKEN' : null,
          !chatId ? 'TELEGRAM_CHAT_ID' : null,
        ].filter(Boolean)
        return json(500, {
          ok: false,
          error: `Server misconfigured: missing ${missing.join(', ')}`,
        })
      }

      if (!body?.name || !body?.phone || !body?.model || !body?.size) {
        return json(400, {
          ok: false,
          error: 'Required fields: name, phone, model, size',
        })
      }

      const cityCheck = validateCity(body?.city)
      if (!cityCheck.ok) {
        return json(400, { ok: false, error: cityCheck.message })
      }
      body.city = String(body.city || '').trim()

      const text = buildDigest(body)
      const photoUrl = resolvePhotoUrl(
        publicBaseUrl(),
        body.model,
        body.color || '',
      )

      async function tryDeliver(withThread, url) {
        return deliver({
          token,
          chatId,
          threadId: withThread ? threadId : '',
          text,
          photoUrl: url,
        })
      }

      let result
      let warning
      try {
        result = await tryDeliver(Boolean(threadId), photoUrl)
      } catch (photoErr) {
        console.warn(
          '[order] photo pipeline failed; falling back to text:',
          photoErr instanceof Error ? photoErr.message : photoErr,
        )
        result = await tryDeliver(Boolean(threadId), null)
        if (result.ok) {
          warning = `Delivered as text (${photoErr instanceof Error ? photoErr.message : 'photo failed'})`
        }
      }

      if (
        result &&
        !result.ok &&
        photoUrl &&
        result.mode === 'photo'
      ) {
        console.warn(
          '[order] sendPhoto failed; falling back to text:',
          telegramSafeError(result.body),
        )
        result = await tryDeliver(Boolean(threadId), null)
        if (result.ok) {
          warning = 'Delivered as text (Telegram rejected photo upload)'
        }
      }

      if (result && !result.ok && threadId && isThreadError(result.body)) {
        console.warn(
          '[order] Telegram rejected message_thread_id; retrying without thread',
        )
        try {
          result = await tryDeliver(false, photoUrl)
        } catch {
          result = await tryDeliver(false, null)
        }
        if (result.ok) {
          warning =
            warning ||
            'Delivered without message_thread_id (thread id rejected)'
        }
      }

      if (!result?.ok) {
        console.error(
          '[order] Telegram send failed:',
          telegramSafeError(result?.body),
        )
        return json(502, {
          ok: false,
          error: telegramSafeError(result?.body),
          telegramStatus: result?.status,
          photoUrl: photoUrl || undefined,
        })
      }

      return json(200, {
        ok: true,
        mode: result.mode,
        usedThread: result.usedThread,
        photoUrl: photoUrl || undefined,
        ...(warning ? { warning } : {}),
      })
    } catch (err) {
      console.error(
        '[order] handler error:',
        err instanceof Error ? err.stack || err.message : err,
      )
      return json(500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Internal order error',
      })
    }
  },
}
