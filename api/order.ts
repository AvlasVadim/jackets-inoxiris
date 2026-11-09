import {
  jsonResponse,
  processOrder,
  publicBaseUrlFromRequest,
  readTelegramEnv,
  type OrderBody,
} from '../lib/vercelTelegramOrder'

/**
 * Vercel Node function — Web Standard handler ("type": "module" safe).
 * Local Vite middleware remains server/telegramOrderPlugin.ts.
 */
export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(405, { ok: false, error: 'Method not allowed' })
    }

    try {
      let body: OrderBody
      try {
        body = (await request.json()) as OrderBody
      } catch {
        return jsonResponse(400, { ok: false, error: 'Invalid JSON body' })
      }

      const result = await processOrder({
        env: readTelegramEnv(),
        body,
        publicBaseUrl: publicBaseUrlFromRequest(request),
      })

      if (!result.ok) {
        return jsonResponse(result.status, {
          ok: false,
          error: result.error,
          ...(result.telegramStatus
            ? { telegramStatus: result.telegramStatus }
            : {}),
        })
      }

      return jsonResponse(200, {
        ok: true,
        mode: result.mode,
        usedThread: result.usedThread,
        ...(result.warning ? { warning: result.warning } : {}),
      })
    } catch (err) {
      console.error(
        '[order] handler error:',
        err instanceof Error ? err.stack || err.message : err,
      )
      return jsonResponse(500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Internal order error',
      })
    }
  },
}
