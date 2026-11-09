/**
 * Vercel-safe order helpers (no filesystem). Photos go by public URL.
 * Local Vite middleware keeps using server/telegramOrderCore.ts.
 */

export type OrderBody = {
  name?: string
  phone?: string
  city?: string
  model?: string
  size?: string
  color?: string
  comment?: string
}

export type TelegramUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
}

export type TelegramMessage = {
  message_id: number
  chat: { id: number }
  text?: string
  caption?: string
  photo?: unknown[]
}

export type CallbackQuery = {
  id: string
  from?: TelegramUser
  data?: string
  message?: TelegramMessage
}

type TelegramEnv = {
  token: string
  chatId: string
  threadId: string
  webhookSecret: string
}

type SendResult = {
  ok: boolean
  status: number
  body: unknown
  usedThread: boolean
  mode: 'photo' | 'text'
}

export type ProcessOrderResult =
  | {
      ok: true
      status: 200
      mode: 'photo' | 'text'
      usedThread: boolean
      warning?: string
    }
  | {
      ok: false
      status: number
      error: string
      telegramStatus?: number
    }

const ORDER_KB = {
  inline_keyboard: [
    [
      { text: '✅ Одобрить', callback_data: 'ord:ok' },
      { text: '❌ Отклонить', callback_data: 'ord:no' },
    ],
  ],
}

const STATUS_MARKERS = ['✅ Одобрено', '❌ Отклонено'] as const

/** Minimal catalog id map for photo URLs (mirrors src/data/products). */
const PRODUCT_IDS: Record<string, string> = {
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

const COLOR_LABEL_TO_SLUG: Record<string, string> = {
  Бежевый: 'beige',
  Белый: 'white',
  Чёрный: 'black',
  Черный: 'black',
  Розовый: 'pink',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatNow(): string {
  return new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Minsk',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function buildDigest(body: OrderBody): string {
  const row = (emoji: string, label: string, value: string) =>
    `${emoji} <b>${label}:</b> ${escapeHtml(value || '—')}`

  return [
    '🆕 <b>Заявка InOxiris</b>',
    '',
    '📦 <b>Товар</b>',
    '────────',
    row('👗', 'Модель', body.model ?? ''),
    row('📏', 'Рост / размер', body.size ?? ''),
    row('🎨', 'Цвет', body.color ?? ''),
    '',
    '👤 <b>Клиент</b>',
    '────────',
    row('✍️', 'Имя', body.name ?? ''),
    row('📞', 'Телефон', body.phone ?? ''),
    row('🏙', 'Город', body.city ?? ''),
    row('💬', 'Комментарий', body.comment ?? ''),
    row('🕒', 'Время', formatNow()),
  ].join('\n')
}

function colorLabelToSlug(label: string): string | null {
  const key = label.trim()
  if (!key || key.toLowerCase() === 'любой') return null
  const direct = COLOR_LABEL_TO_SLUG[key]
  if (direct) return direct
  const found = Object.entries(COLOR_LABEL_TO_SLUG).find(
    ([ru]) => ru.toLowerCase() === key.toLowerCase(),
  )
  return found ? found[1] : null
}

function resolveProductId(modelName: string): string | null {
  const key = modelName.trim().toLowerCase()
  if (PRODUCT_IDS[key]) return PRODUCT_IDS[key]
  const match = key.match(/^модель\s*(\d{1,2})$/)
  if (match) return match[1].padStart(2, '0')
  return null
}

export function resolvePublicPhotoUrl(
  baseUrl: string | undefined,
  modelName: string,
  colorLabel: string,
): string | null {
  if (!baseUrl) return null
  const slug = colorLabelToSlug(colorLabel)
  const productId = resolveProductId(modelName)
  if (!slug || !productId) return null
  return `${baseUrl.replace(/\/$/, '')}/products/colors/${productId}/${slug}.jpg`
}

export function readTelegramEnv(
  source: Record<string, string | undefined> = process.env,
): TelegramEnv {
  return {
    token: String(source.TELEGRAM_BOT_TOKEN || '').trim(),
    chatId: String(source.TELEGRAM_CHAT_ID || '-1003739761141').trim(),
    threadId: String(source.TELEGRAM_MESSAGE_THREAD_ID || '2').trim(),
    webhookSecret: String(source.TELEGRAM_WEBHOOK_SECRET || '').trim(),
  }
}

async function tgApi(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean((body as { ok?: boolean }).ok),
    status: res.status,
    body,
  }
}

function telegramSafeError(body: unknown): string {
  if (!body || typeof body !== 'object') return 'unknown Telegram error'
  const desc = (body as { description?: string }).description
  return desc || JSON.stringify(body)
}

function isThreadError(body: unknown): boolean {
  const err = telegramSafeError(body).toLowerCase()
  return (
    err.includes('thread') ||
    err.includes('topic') ||
    err.includes('message_thread_id')
  )
}

async function sendTelegramMessage(opts: {
  token: string
  chatId: string
  threadId?: string
  text: string
}): Promise<SendResult> {
  const payload: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: ORDER_KB,
  }
  if (opts.threadId) payload.message_thread_id = Number(opts.threadId)
  const result = await tgApi(opts.token, 'sendMessage', payload)
  return { ...result, usedThread: Boolean(opts.threadId), mode: 'text' }
}

async function sendTelegramPhotoUrl(opts: {
  token: string
  chatId: string
  threadId?: string
  caption: string
  photoUrl: string
}): Promise<SendResult> {
  const payload: Record<string, unknown> = {
    chat_id: opts.chatId,
    photo: opts.photoUrl,
    caption: opts.caption,
    parse_mode: 'HTML',
    reply_markup: ORDER_KB,
  }
  if (opts.threadId) payload.message_thread_id = Number(opts.threadId)
  const result = await tgApi(opts.token, 'sendPhoto', payload)
  return { ...result, usedThread: Boolean(opts.threadId), mode: 'photo' }
}

export async function processOrder(opts: {
  env: TelegramEnv
  body: OrderBody
  publicBaseUrl?: string
}): Promise<ProcessOrderResult> {
  const { env, body, publicBaseUrl } = opts
  const { token, chatId, threadId } = env

  if (!token || !chatId) {
    const missing = [
      !token ? 'TELEGRAM_BOT_TOKEN' : null,
      !chatId ? 'TELEGRAM_CHAT_ID' : null,
    ].filter(Boolean)
    return {
      ok: false,
      status: 500,
      error: `Server misconfigured: missing ${missing.join(', ')}`,
    }
  }

  if (!body.name || !body.phone || !body.model || !body.size) {
    return {
      ok: false,
      status: 400,
      error: 'Required fields: name, phone, model, size',
    }
  }

  const text = buildDigest(body)
  const photoUrl = resolvePublicPhotoUrl(
    publicBaseUrl,
    body.model,
    body.color || '',
  )

  async function deliver(withThread: boolean): Promise<SendResult> {
    const thread = withThread ? threadId : undefined
    if (photoUrl) {
      return sendTelegramPhotoUrl({
        token,
        chatId,
        threadId: thread,
        caption: text,
        photoUrl,
      })
    }
    return sendTelegramMessage({
      token,
      chatId,
      threadId: thread,
      text,
    })
  }

  let result = await deliver(Boolean(threadId))

  // If photo URL fetch failed on Telegram side, fall back to text.
  if (!result.ok && photoUrl && result.mode === 'photo') {
    console.warn(
      '[order] sendPhoto failed; falling back to text:',
      telegramSafeError(result.body),
    )
    result = await sendTelegramMessage({
      token,
      chatId,
      threadId: threadId || undefined,
      text,
    })
    if (result.ok) {
      return {
        ok: true,
        status: 200,
        mode: 'text',
        usedThread: result.usedThread,
        warning: 'Delivered as text (photo URL rejected by Telegram)',
      }
    }
  }

  if (!result.ok && threadId && isThreadError(result.body)) {
    console.warn(
      '[order] Telegram rejected message_thread_id; retrying without thread',
    )
    result = await deliver(false)
    if (result.ok) {
      return {
        ok: true,
        status: 200,
        mode: result.mode,
        usedThread: false,
        warning: 'Delivered without message_thread_id (thread id rejected)',
      }
    }
  }

  if (!result.ok) {
    console.error(
      '[order] Telegram send failed:',
      telegramSafeError(result.body),
    )
    return {
      ok: false,
      status: 502,
      error: telegramSafeError(result.body),
      telegramStatus: result.status,
    }
  }

  return {
    ok: true,
    status: 200,
    mode: result.mode,
    usedThread: result.usedThread,
  }
}

function formatActor(user?: TelegramUser): string {
  if (!user) return 'менеджер'
  if (user.username) return `@${user.username}`
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name || `id:${user.id ?? '?'}`
}

function messageAlreadyDecided(text: string | undefined): boolean {
  if (!text) return false
  return STATUS_MARKERS.some((marker) => text.includes(marker))
}

function appendDecision(
  original: string,
  approved: boolean,
  actor: string,
): string {
  const status = approved ? '✅ Одобрено' : '❌ Отклонено'
  const stamp = formatNow()
  return `${original.trim()}\n\n────────\n<b>${status}</b>\n👤 ${escapeHtml(actor)}\n🕒 ${escapeHtml(stamp)}`
}

export async function handleCallbackQuery(
  token: string,
  query: CallbackQuery,
): Promise<void> {
  const data = (query.data || '').trim()
  if (data !== 'ord:ok' && data !== 'ord:no') return

  const message = query.message
  if (!message) {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Сообщение недоступно',
      show_alert: true,
    })
    return
  }

  const isPhoto = Array.isArray(message.photo) && message.photo.length > 0
  const current = isPhoto ? message.caption || '' : message.text || ''

  if (messageAlreadyDecided(current)) {
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Заявка уже обработана',
      show_alert: true,
    })
    await tgApi(token, 'editMessageReplyMarkup', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

  const approved = data === 'ord:ok'
  const actor = formatActor(query.from)
  const nextText = appendDecision(current, approved, actor)

  const editMethod = isPhoto ? 'editMessageCaption' : 'editMessageText'
  const editPayload: Record<string, unknown> = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [] },
  }
  if (isPhoto) {
    editPayload.caption = nextText
  } else {
    editPayload.text = nextText
    editPayload.disable_web_page_preview = true
  }

  const edited = await tgApi(token, editMethod, editPayload)
  if (!edited.ok) {
    console.error(
      '[order] edit after callback failed:',
      telegramSafeError(edited.body),
    )
    await tgApi(token, 'answerCallbackQuery', {
      callback_query_id: query.id,
      text: 'Не удалось обновить заявку',
      show_alert: true,
    })
    return
  }

  await tgApi(token, 'answerCallbackQuery', {
    callback_query_id: query.id,
    text: approved ? 'Одобрено' : 'Отклонено',
  })
}

export async function handleTelegramUpdate(
  token: string,
  update: { callback_query?: CallbackQuery },
): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(token, update.callback_query)
  }
}

export function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function publicBaseUrlFromRequest(request: Request): string | undefined {
  const fromEnv = (
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ''
  ).trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const vercel = (process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`

  try {
    const url = new URL(request.url)
    if (url.origin && url.origin !== 'null') return url.origin
  } catch {
    /* ignore */
  }
  return undefined
}
