/**
 * Vercel serverless order endpoint (plain ESM, no TS / no shared imports).
 * Vite local middleware stays in server/telegramOrderPlugin.ts.
 */

const ORDER_KB = {
  inline_keyboard: [
    [
      { text: '✅ Одобрить', callback_data: 'ord:ok' },
      { text: '❌ Отклонить', callback_data: 'ord:no' },
    ],
  ],
}

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

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
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

function publicBaseUrl(request) {
  const fromEnv = String(
    process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '',
  ).trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  const vercel = String(process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`
  try {
    return new URL(request.url).origin
  } catch {
    return undefined
  }
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

async function deliver({ token, chatId, threadId, text, photoUrl }) {
  const payload = {
    chat_id: chatId,
    parse_mode: 'HTML',
    reply_markup: ORDER_KB,
  }
  if (threadId) payload.message_thread_id = Number(threadId)

  if (photoUrl) {
    payload.photo = photoUrl
    payload.caption = text
    const result = await tgApi(token, 'sendPhoto', payload)
    return { ...result, mode: 'photo', usedThread: Boolean(threadId) }
  }

  payload.text = text
  payload.disable_web_page_preview = true
  const result = await tgApi(token, 'sendMessage', payload)
  return { ...result, mode: 'text', usedThread: Boolean(threadId) }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    try {
      let body
      try {
        body = await request.json()
      } catch {
        return json(400, { ok: false, error: 'Invalid JSON body' })
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

      const text = buildDigest(body)
      const photoUrl = resolvePhotoUrl(
        publicBaseUrl(request),
        body.model,
        body.color || '',
      )

      let result = await deliver({
        token,
        chatId,
        threadId,
        text,
        photoUrl,
      })

      if (!result.ok && photoUrl && result.mode === 'photo') {
        console.warn(
          '[order] sendPhoto failed; falling back to text:',
          telegramSafeError(result.body),
        )
        result = await deliver({
          token,
          chatId,
          threadId,
          text,
          photoUrl: null,
        })
        if (result.ok) {
          return json(200, {
            ok: true,
            mode: 'text',
            usedThread: result.usedThread,
            warning: 'Delivered as text (photo URL rejected by Telegram)',
          })
        }
      }

      if (!result.ok && threadId && isThreadError(result.body)) {
        console.warn(
          '[order] Telegram rejected message_thread_id; retrying without thread',
        )
        result = await deliver({
          token,
          chatId,
          threadId: '',
          text,
          photoUrl,
        })
        if (result.ok) {
          return json(200, {
            ok: true,
            mode: result.mode,
            usedThread: false,
            warning:
              'Delivered without message_thread_id (thread id rejected)',
          })
        }
      }

      if (!result.ok) {
        console.error(
          '[order] Telegram send failed:',
          telegramSafeError(result.body),
        )
        return json(502, {
          ok: false,
          error: telegramSafeError(result.body),
          telegramStatus: result.status,
        })
      }

      return json(200, {
        ok: true,
        mode: result.mode,
        usedThread: result.usedThread,
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
