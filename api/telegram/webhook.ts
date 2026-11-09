import {
  handleTelegramUpdate,
  jsonResponse,
  readTelegramEnv,
  type CallbackQuery,
} from '../../lib/vercelTelegramOrder'

/**
 * Production callback path for Approve/Reject.
 * After deploy:
 *   setWebhook?url=https://<domain>/api/telegram/webhook
 *   &secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *   &allowed_updates=["callback_query"]
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(405, { ok: false, error: 'Method not allowed' })
    }

    try {
      const { token, webhookSecret } = readTelegramEnv()
      if (!token) {
        return jsonResponse(500, { ok: false, error: 'Bot token missing' })
      }

      if (webhookSecret) {
        const header = request.headers.get('x-telegram-bot-api-secret-token')
        if (header !== webhookSecret) {
          return jsonResponse(401, { ok: false, error: 'Unauthorized' })
        }
      }

      let update: { callback_query?: CallbackQuery }
      try {
        update = (await request.json()) as { callback_query?: CallbackQuery }
      } catch {
        return jsonResponse(400, { ok: false, error: 'Invalid JSON body' })
      }

      await handleTelegramUpdate(token, update)
      return jsonResponse(200, { ok: true })
    } catch (err) {
      console.error(
        '[order] webhook error:',
        err instanceof Error ? err.stack || err.message : err,
      )
      return jsonResponse(500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Webhook handler error',
      })
    }
  },
}
