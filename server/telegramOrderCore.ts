import fs from 'node:fs'
import path from 'node:path'
import { products } from '../src/data/products'
import { colorLabelToSlug } from '../src/data/productColors'

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
  reply_markup?: unknown
}

export type CallbackQuery = {
  id: string
  from?: TelegramUser
  data?: string
  message?: TelegramMessage
}

export type TelegramEnv = {
  token: string
  chatId: string
  threadId: string
  webhookSecret: string
}

export type SendResult = {
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

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function formatNow(): string {
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

export function resolveVariantPhotoRel(
  modelName: string,
  colorLabel: string,
): string | null {
  const slug = colorLabelToSlug(colorLabel)
  if (!slug) return null
  const product = products.find(
    (p) => p.name.toLowerCase() === modelName.trim().toLowerCase(),
  )
  if (!product) return null
  return path.posix.join('products', 'colors', product.id, `${slug}.jpg`)
}

export function resolveVariantPhotoPath(
  root: string,
  modelName: string,
  colorLabel: string,
): string | null {
  const rel = resolveVariantPhotoRel(modelName, colorLabel)
  if (!rel) return null
  const candidates = [
    path.join(root, 'public', ...rel.split('/')),
    path.join(root, 'dist', ...rel.split('/')),
    path.join(root, ...rel.split('/')),
  ]
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) return filePath
  }
  return null
}

export function resolvePublicPhotoUrl(
  baseUrl: string | undefined,
  modelName: string,
  colorLabel: string,
): string | null {
  if (!baseUrl) return null
  const rel = resolveVariantPhotoRel(modelName, colorLabel)
  if (!rel) return null
  return `${baseUrl.replace(/\/$/, '')}/${rel}`
}

export async function tgApi(
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

export async function sendTelegramMessage(opts: {
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
  if (opts.threadId) {
    payload.message_thread_id = Number(opts.threadId)
  }

  const result = await tgApi(opts.token, 'sendMessage', payload)
  return {
    ...result,
    usedThread: Boolean(opts.threadId),
    mode: 'text',
  }
}

export async function sendTelegramPhoto(opts: {
  token: string
  chatId: string
  threadId?: string
  caption: string
  photoPath?: string
  photoUrl?: string
}): Promise<SendResult> {
  if (opts.photoUrl && !opts.photoPath) {
    const payload: Record<string, unknown> = {
      chat_id: opts.chatId,
      photo: opts.photoUrl,
      caption: opts.caption,
      parse_mode: 'HTML',
      reply_markup: ORDER_KB,
    }
    if (opts.threadId) {
      payload.message_thread_id = Number(opts.threadId)
    }
    const result = await tgApi(opts.token, 'sendPhoto', payload)
    return {
      ...result,
      usedThread: Boolean(opts.threadId),
      mode: 'photo',
    }
  }

  if (!opts.photoPath) {
    return {
      ok: false,
      status: 500,
      body: { description: 'No photo source provided' },
      usedThread: Boolean(opts.threadId),
      mode: 'photo',
    }
  }

  const url = `https://api.telegram.org/bot${opts.token}/sendPhoto`
  const bytes = fs.readFileSync(opts.photoPath)
  const form = new FormData()
  form.append('chat_id', opts.chatId)
  form.append('caption', opts.caption)
  form.append('parse_mode', 'HTML')
  form.append('reply_markup', JSON.stringify(ORDER_KB))
  if (opts.threadId) {
    form.append('message_thread_id', opts.threadId)
  }
  form.append(
    'photo',
    new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
    path.basename(opts.photoPath),
  )

  const res = await fetch(url, { method: 'POST', body: form })
  const body = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean((body as { ok?: boolean }).ok),
    status: res.status,
    body,
    usedThread: Boolean(opts.threadId),
    mode: 'photo',
  }
}

export function telegramSafeError(body: unknown): string {
  if (!body || typeof body !== 'object') return 'unknown Telegram error'
  const desc = (body as { description?: string }).description
  return desc || JSON.stringify(body)
}

export function isThreadError(body: unknown): boolean {
  const err = telegramSafeError(body).toLowerCase()
  return (
    err.includes('thread') ||
    err.includes('topic') ||
    err.includes('message_thread_id')
  )
}

function formatActor(user?: TelegramUser): string {
  if (!user) return 'менеджер'
  if (user.username) return `@${user.username}`
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name || `id:${user.id ?? '?'}`
}

export function parseApproverIds(raw: string | undefined): string[] {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/** Empty whitelist denies all Approve/Reject presses until TELEGRAM_APPROVER_IDS is set. */
export function checkApproverAccess(
  query: CallbackQuery,
  source: Record<string, string | undefined> = process.env,
): { ok: true } | { ok: false; text: string } {
  const ids = parseApproverIds(source.TELEGRAM_APPROVER_IDS)
  if (ids.length === 0) {
    return {
      ok: false,
      text: 'Вайтлист пуст. Задайте TELEGRAM_APPROVER_IDS',
    }
  }
  const userId = query.from?.id != null ? String(query.from.id) : ''
  if (!userId || !ids.includes(userId)) {
    return { ok: false, text: 'Нет доступа' }
  }
  return { ok: true }
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

async function answerCallbackQuerySafe(
  token: string,
  queryId: string | undefined,
  opts: { text?: string; show_alert?: boolean } = {},
): Promise<void> {
  if (!token || !queryId) return
  try {
    const payload: Record<string, unknown> = { callback_query_id: queryId }
    if (opts.text) payload.text = opts.text
    if (opts.show_alert) payload.show_alert = true
    const result = await tgApi(token, 'answerCallbackQuery', payload)
    if (!result.ok) {
      console.error(
        '[order] answerCallbackQuery failed:',
        telegramSafeError(result.body),
      )
    }
  } catch (err) {
    console.error(
      '[order] answerCallbackQuery threw:',
      err instanceof Error ? err.message : err,
    )
  }
}

export async function handleCallbackQuery(
  token: string,
  query: CallbackQuery,
): Promise<void> {
  const data = (query.data || '').trim()
  if (data !== 'ord:ok' && data !== 'ord:no') {
    await answerCallbackQuerySafe(token, query.id, {
      text: 'Неизвестная команда',
      show_alert: true,
    })
    return
  }

  const access = checkApproverAccess(query)
  if (!access.ok) {
    await answerCallbackQuerySafe(token, query.id, {
      text: access.text,
      show_alert: true,
    })
    return
  }

  const message = query.message
  if (!message) {
    await answerCallbackQuerySafe(token, query.id, {
      text: 'Сообщение недоступно',
      show_alert: true,
    })
    return
  }

  const isPhoto = Array.isArray(message.photo) && message.photo.length > 0
  const current = isPhoto ? message.caption || '' : message.text || ''
  const already = messageAlreadyDecided(current)
  const approved = data === 'ord:ok'

  // Answer BEFORE editing so a slow/failed edit cannot leave the spinner spinning.
  await answerCallbackQuerySafe(token, query.id, {
    text: already
      ? 'Заявка уже обработана'
      : approved
        ? 'Одобрено'
        : 'Отклонено',
    show_alert: already,
  })

  if (already) {
    await tgApi(token, 'editMessageReplyMarkup', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: { inline_keyboard: [] },
    })
    return
  }

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
  }
}

export async function handleTelegramUpdate(
  token: string,
  update: { callback_query?: CallbackQuery },
): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(token, update.callback_query)
  }
}

export function readTelegramEnv(
  source: Record<string, string | undefined> = process.env,
): TelegramEnv {
  return {
    token: (source.TELEGRAM_BOT_TOKEN || '').trim(),
    chatId: (source.TELEGRAM_CHAT_ID || '-1003739761141').trim(),
    threadId: (source.TELEGRAM_MESSAGE_THREAD_ID || '2').trim(),
    webhookSecret: (source.TELEGRAM_WEBHOOK_SECRET || '').trim(),
  }
}

export async function processOrder(opts: {
  env: TelegramEnv
  body: OrderBody
  root?: string
  publicBaseUrl?: string
}): Promise<ProcessOrderResult> {
  const { env, body, root, publicBaseUrl } = opts
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
  const photoPath = root
    ? resolveVariantPhotoPath(root, body.model, body.color || '')
    : null
  const photoUrl =
    !photoPath && publicBaseUrl
      ? resolvePublicPhotoUrl(publicBaseUrl, body.model, body.color || '')
      : null

  async function deliver(withThread: boolean): Promise<SendResult> {
    const thread = withThread ? threadId : undefined
    if (photoPath || photoUrl) {
      return sendTelegramPhoto({
        token,
        chatId,
        threadId: thread,
        caption: text,
        photoPath: photoPath || undefined,
        photoUrl: photoUrl || undefined,
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
