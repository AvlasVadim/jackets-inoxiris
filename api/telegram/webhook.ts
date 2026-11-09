import {
  handleTelegramUpdate,
  readTelegramEnv,
  type CallbackQuery,
} from '../../server/telegramOrderCore'

type VercelRequest = {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

/**
 * Production callback path for Approve/Reject inline buttons.
 * Local `npm run dev` uses getUpdates polling instead.
 *
 * After deploy, set webhook once:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook
 *     ?url=https://<your-domain>/api/telegram/webhook
 *     &secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *     &allowed_updates=["callback_query"]
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { token, webhookSecret } = readTelegramEnv()
  if (!token) {
    return res.status(500).json({ ok: false, error: 'Bot token missing' })
  }

  if (webhookSecret) {
    const header = req.headers['x-telegram-bot-api-secret-token']
    const value = Array.isArray(header) ? header[0] : header
    if (value !== webhookSecret) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }
  }

  try {
    const update = (
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
    ) as { callback_query?: CallbackQuery }

    await handleTelegramUpdate(token, update)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error(
      '[order] webhook error:',
      err instanceof Error ? err.message : err,
    )
    return res.status(500).json({ ok: false, error: 'Webhook handler error' })
  }
}
