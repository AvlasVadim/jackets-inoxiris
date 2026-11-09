import {
  processOrder,
  readTelegramEnv,
  type OrderBody,
} from '../server/telegramOrderCore'

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

function publicBaseUrl(req: VercelRequest): string | undefined {
  const fromEnv = (
    process.env.PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ''
  ).trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  const vercel = (process.env.VERCEL_URL || '').trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '')}`

  const protoHeader = req.headers['x-forwarded-proto']
  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host
  const proto = Array.isArray(protoHeader)
    ? protoHeader[0]
    : protoHeader || 'https'
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader
  if (host) return `${proto}://${host}`
  return undefined
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const body = (
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {}
    ) as OrderBody

    const result = await processOrder({
      env: readTelegramEnv(),
      body,
      root: process.cwd(),
      publicBaseUrl: publicBaseUrl(req),
    })

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
        ...(result.telegramStatus
          ? { telegramStatus: result.telegramStatus }
          : {}),
      })
    }

    return res.status(200).json({
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
    return res.status(500).json({ ok: false, error: 'Internal order error' })
  }
}
