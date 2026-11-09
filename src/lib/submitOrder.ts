export type OrderPayload = {
  name: string
  phone: string
  city: string
  model: string
  size: string
  color: string
  comment: string
}

export type SubmitOrderResult = {
  ok: boolean
  warning?: string
  error?: string
}

/**
 * Client → `/api/order` → Telegram sendMessage / sendPhoto.
 * Local: Vite middleware (telegramOrderPlugin). Prod: Vercel serverless `api/order`.
 * Matching color variants attach a product photo; «Любой» stays text-only.
 * Bot token stays server-side only (.env.local / Vercel Env).
 */
export async function submitOrder(
  payload: OrderPayload,
): Promise<SubmitOrderResult> {
  const res = await fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    warning?: string
    error?: string
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error || `HTTP ${res.status}`,
    }
  }

  return { ok: true, warning: data.warning }
}
