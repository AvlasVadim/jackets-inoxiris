import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, Connect, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import { products } from '../src/data/products'
import { colorLabelToSlug } from '../src/data/productColors'

type OrderBody = {
  name?: string
  phone?: string
  city?: string
  model?: string
  size?: string
  color?: string
  comment?: string
}

type TelegramUser = {
  id?: number
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramMessage = {
  message_id: number
  chat: { id: number }
  text?: string
  caption?: string
  photo?: unknown[]
  reply_markup?: unknown
}

type CallbackQuery = {
  id: string
  from?: TelegramUser
  data?: string
  message?: TelegramMessage
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

function readJson(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
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

function buildDigest(body: OrderBody): string {
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

function resolveVariantPhoto(
  root: string,
  modelName: string,
  colorLabel: string,
) {
  const slug = colorLabelToSlug(colorLabel)
  if (!slug) return null
  const product = products.find(
    (p) => p.name.toLowerCase() === modelName.trim().toLowerCase(),
  )
  if (!product) return null
  const filePath = path.join(
    root,
    'public',
    'products',
    'colors',
    product.id,
    `${slug}.jpg`,
  )
  return fs.existsSync(filePath) ? filePath : null
}

type SendResult = {
  ok: boolean
  status: number
  body: unknown
  usedThread: boolean
  mode: 'photo' | 'text'
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

async function sendTelegramPhoto(opts: {
  token: string
  chatId: string
  threadId?: string
  caption: string
  photoPath: string
}): Promise<SendResult> {
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

async function handleCallbackQuery(
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

async function handleTelegramUpdate(
  token: string,
  update: { callback_query?: CallbackQuery },
): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(token, update.callback_query)
  }
}

function startCallbackPolling(token: string): () => void {
  let stopped = false
  let offset = 0

  ;(async () => {
    // Drop pending updates so old callbacks don't fire after restart.
    try {
      const boot = await fetch(
        `https://api.telegram.org/bot${token}/getUpdates?offset=-1&timeout=0`,
      )
      const bootBody = (await boot.json().catch(() => ({}))) as {
        ok?: boolean
        result?: Array<{ update_id: number }>
      }
      const last = bootBody.result?.at(-1)
      if (bootBody.ok && last) offset = last.update_id + 1
    } catch {
      /* ignore boot trim errors */
    }

    console.info(
      '[order] Telegram callback polling on (getUpdates) — Approve/Reject buttons',
    )

    while (!stopped) {
      try {
        const url =
          `https://api.telegram.org/bot${token}/getUpdates` +
          `?offset=${offset}&timeout=25&allowed_updates=${encodeURIComponent(JSON.stringify(['callback_query']))}`
        const res = await fetch(url)
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          result?: Array<{ update_id: number; callback_query?: CallbackQuery }>
          description?: string
        }

        if (!body.ok) {
          const desc = (body.description || '').toLowerCase()
          if (desc.includes('webhook')) {
            console.warn(
              '[order] getUpdates blocked by webhook — POST /api/telegram/webhook instead, or deleteWebhook',
            )
            await new Promise((r) => setTimeout(r, 15_000))
            continue
          }
          await new Promise((r) => setTimeout(r, 3_000))
          continue
        }

        for (const update of body.result || []) {
          offset = update.update_id + 1
          try {
            await handleTelegramUpdate(token, update)
          } catch (err) {
            console.error(
              '[order] callback handler error:',
              err instanceof Error ? err.message : err,
            )
          }
        }
      } catch (err) {
        if (stopped) break
        console.warn(
          '[order] polling hiccup:',
          err instanceof Error ? err.message : err,
        )
        await new Promise((r) => setTimeout(r, 2_000))
      }
    }
  })()

  return () => {
    stopped = true
  }
}

function json(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  status: number,
  payload: unknown,
) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function attachTelegramRoutes(
  middlewares: Connect.Server,
  opts: {
    token: string
    chatId: string
    threadId: string
    root: string
    webhookSecret: string
  },
) {
  const { token, chatId, threadId, root, webhookSecret } = opts

  middlewares.use(async (req, res, next) => {
    const urlPath = req.url?.split('?')[0] || ''

    if (urlPath === '/api/telegram/webhook' && req.method === 'POST') {
      if (!token) {
        json(res, 500, { ok: false, error: 'Bot token missing' })
        return
      }
      if (webhookSecret) {
        const header = req.headers['x-telegram-bot-api-secret-token']
        if (header !== webhookSecret) {
          json(res, 401, { ok: false, error: 'Unauthorized' })
          return
        }
      }
      try {
        const update = (await readJson(req)) as {
          callback_query?: CallbackQuery
        }
        await handleTelegramUpdate(token, update)
        json(res, 200, { ok: true })
      } catch (err) {
        console.error(
          '[order] webhook error:',
          err instanceof Error ? err.message : err,
        )
        json(res, 500, { ok: false, error: 'Webhook handler error' })
      }
      return
    }

    if (urlPath !== '/api/order' || req.method !== 'POST') {
      next()
      return
    }

    if (!token || !chatId) {
      const missing = [
        !token ? 'TELEGRAM_BOT_TOKEN' : null,
        !chatId ? 'TELEGRAM_CHAT_ID' : null,
      ].filter(Boolean)
      json(res, 500, {
        ok: false,
        error: `Server misconfigured: missing ${missing.join(', ')}`,
      })
      return
    }

    try {
      const body = (await readJson(req)) as OrderBody
      if (!body.name || !body.phone || !body.model || !body.size) {
        json(res, 400, {
          ok: false,
          error: 'Required fields: name, phone, model, size',
        })
        return
      }

      const text = buildDigest(body)
      const photoPath = resolveVariantPhoto(
        root,
        body.model,
        body.color || '',
      )

      async function deliver(withThread: boolean): Promise<SendResult> {
        const thread = withThread ? threadId : undefined
        if (photoPath) {
          return sendTelegramPhoto({
            token,
            chatId,
            threadId: thread,
            caption: text,
            photoPath,
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
          json(res, 200, {
            ok: true,
            mode: result.mode,
            warning:
              'Delivered without message_thread_id (thread id rejected)',
          })
          return
        }
      }

      if (!result.ok) {
        console.error(
          '[order] Telegram send failed:',
          telegramSafeError(result.body),
        )
        json(res, 502, {
          ok: false,
          error: telegramSafeError(result.body),
          telegramStatus: result.status,
        })
        return
      }

      json(res, 200, {
        ok: true,
        mode: result.mode,
        usedThread: result.usedThread,
      })
    } catch (err) {
      console.error(
        '[order] handler error:',
        err instanceof Error ? err.message : err,
      )
      json(res, 500, { ok: false, error: 'Internal order error' })
    }
  })
}

function loadTelegramEnv(mode: string, root: string) {
  const env = loadEnv(mode, root, '')
  return {
    token: (
      process.env.TELEGRAM_BOT_TOKEN ||
      env.TELEGRAM_BOT_TOKEN ||
      ''
    ).trim(),
    chatId: (
      process.env.TELEGRAM_CHAT_ID ||
      env.TELEGRAM_CHAT_ID ||
      '-1003739761141'
    ).trim(),
    threadId: (
      process.env.TELEGRAM_MESSAGE_THREAD_ID ||
      env.TELEGRAM_MESSAGE_THREAD_ID ||
      '2'
    ).trim(),
    webhookSecret: (
      process.env.TELEGRAM_WEBHOOK_SECRET ||
      env.TELEGRAM_WEBHOOK_SECRET ||
      ''
    ).trim(),
  }
}

function wireServer(
  server: ViteDevServer | PreviewServer,
  mode: string,
) {
  const root = server.config.root
  const { token, chatId, threadId, webhookSecret } = loadTelegramEnv(
    mode,
    root,
  )

  if (!token) {
    console.warn(
      '[order] TELEGRAM_BOT_TOKEN missing — set it in .env.local or process env (never commit)',
    )
  }

  attachTelegramRoutes(server.middlewares, {
    token,
    chatId,
    threadId,
    root,
    webhookSecret,
  })

  let stopPolling: (() => void) | undefined
  if (token) {
    stopPolling = startCallbackPolling(token)
    const httpServer = server.httpServer
    httpServer?.once('close', () => stopPolling?.())
  }
}

export function telegramOrderPlugin(): Plugin {
  return {
    name: 'inoxiris-telegram-order',
    configureServer(server) {
      wireServer(server, server.config.mode)
    },
    configurePreviewServer(server) {
      wireServer(server, server.config.mode)
    },
  }
}
