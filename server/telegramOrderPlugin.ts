import type { Plugin, Connect, PreviewServer, ViteDevServer } from 'vite'
import { loadEnv } from 'vite'
import {
  checkOrderRateLimit,
  clientIpFromHeaders,
  isHoneypotFilled,
  ORDER_RATE_LIMIT_MESSAGE,
} from './orderAntiSpam'
import {
  handleTelegramUpdate,
  processOrder,
  readTelegramEnv,
  type CallbackQuery,
  type OrderBody,
  type TelegramEnv,
} from './telegramOrderCore'

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

function json(
  res: {
    statusCode: number
    setHeader: (k: string, v: string) => void
    end: (b: string) => void
  },
  status: number,
  payload: unknown,
) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
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

function attachTelegramRoutes(
  middlewares: Connect.Server,
  opts: {
    env: TelegramEnv
    root: string
  },
) {
  const { env, root } = opts
  const { token, webhookSecret } = env

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

    try {
      const ip = clientIpFromHeaders(
        req.headers as { [key: string]: string | string[] | undefined },
        req.socket?.remoteAddress || 'unknown',
      )
      const rate = checkOrderRateLimit(ip)
      if (!rate.ok) {
        res.setHeader('Retry-After', String(rate.retryAfterSec))
        json(res, 429, { ok: false, error: ORDER_RATE_LIMIT_MESSAGE })
        return
      }

      const body = (await readJson(req)) as OrderBody
      if (isHoneypotFilled(body as Record<string, unknown>)) {
        console.warn('[order] honeypot filled — soft reject, no Telegram')
        // Soft success so bots do not retry; nothing is sent to Telegram.
        json(res, 200, { ok: true, mode: 'text', usedThread: false })
        return
      }

      const result = await processOrder({ env, body, root })
      if (!result.ok) {
        json(res, result.status, {
          ok: false,
          error: result.error,
          ...(result.telegramStatus
            ? { telegramStatus: result.telegramStatus }
            : {}),
        })
        return
      }
      json(res, 200, {
        ok: true,
        mode: result.mode,
        usedThread: result.usedThread,
        ...(result.warning ? { warning: result.warning } : {}),
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

function loadTelegramEnv(mode: string, root: string): TelegramEnv {
  const env = loadEnv(mode, root, '')
  // Callback handlers read process.env; mirror .env.local for local polling.
  if (
    process.env.TELEGRAM_APPROVER_IDS == null &&
    env.TELEGRAM_APPROVER_IDS != null
  ) {
    process.env.TELEGRAM_APPROVER_IDS = env.TELEGRAM_APPROVER_IDS
  }
  if (
    process.env.TELEGRAM_SHIPPING_THREAD_ID == null &&
    env.TELEGRAM_SHIPPING_THREAD_ID != null
  ) {
    process.env.TELEGRAM_SHIPPING_THREAD_ID = env.TELEGRAM_SHIPPING_THREAD_ID
  }
  return readTelegramEnv({
    TELEGRAM_BOT_TOKEN:
      process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID,
    TELEGRAM_MESSAGE_THREAD_ID:
      process.env.TELEGRAM_MESSAGE_THREAD_ID ||
      env.TELEGRAM_MESSAGE_THREAD_ID,
    TELEGRAM_WEBHOOK_SECRET:
      process.env.TELEGRAM_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET,
  })
}

function wireServer(server: ViteDevServer | PreviewServer, mode: string) {
  const root = server.config.root
  const env = loadTelegramEnv(mode, root)

  if (!env.token) {
    console.warn(
      '[order] TELEGRAM_BOT_TOKEN missing — set it in .env.local or process env (never commit)',
    )
  }

  attachTelegramRoutes(server.middlewares, { env, root })

  let stopPolling: (() => void) | undefined
  if (env.token) {
    stopPolling = startCallbackPolling(env.token)
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
