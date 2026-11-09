#!/usr/bin/env node
/**
 * Register (or inspect) the Telegram bot webhook for production Approve/Reject.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... node scripts/set-telegram-webhook.mjs
 *   TELEGRAM_BOT_TOKEN=... node scripts/set-telegram-webhook.mjs --info
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... node scripts/set-telegram-webhook.mjs
 *
 * Never prints the token. Reads TELEGRAM_* from the environment only
 * (Vercel dashboard / local shell — not committed).
 */

const DEFAULT_WEBHOOK_URL =
  'https://jackets-inoxiris.vercel.app/api/telegram/webhook'

function mask(value) {
  if (!value) return '(empty)'
  if (value.length <= 8) return '***'
  return `${value.slice(0, 4)}…${value.slice(-2)} (len=${value.length})`
}

async function tg(token, method, payload) {
  const url = `https://api.telegram.org/bot${token}/${method}`
  const res = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const body = await res.json().catch(() => ({}))
  return { httpStatus: res.status, body }
}

async function main() {
  const infoOnly = process.argv.includes('--info')
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim()
  const webhookUrl = String(
    process.env.TELEGRAM_WEBHOOK_URL || DEFAULT_WEBHOOK_URL,
  ).trim()

  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is missing in the environment.')
    console.error('')
    console.error('On Vercel: Project → Settings → Environment Variables.')
    console.error('Then run locally (token stays in your shell only):')
    console.error('')
    console.error(
      `  TELEGRAM_BOT_TOKEN='…' node scripts/set-telegram-webhook.mjs`,
    )
    console.error('')
    console.error('Or call Telegram directly (replace <TOKEN>):')
    console.error('')
    console.error(
      `  curl -sS "https://api.telegram.org/bot<TOKEN>/setWebhook" \\`,
    )
    console.error(`    -d "url=${DEFAULT_WEBHOOK_URL}" \\`)
    console.error(`    -d 'allowed_updates=["callback_query"]'`)
    console.error('')
    console.error('Inspect:')
    console.error(
      `  curl -sS "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`,
    )
    process.exit(1)
  }

  console.log('webhook URL:', webhookUrl)
  console.log('token:', mask(token))
  console.log('secret_token:', secret ? mask(secret) : '(not set)')

  const infoBefore = await tg(token, 'getWebhookInfo')
  console.log('getWebhookInfo (before):', JSON.stringify(infoBefore.body, null, 2))

  if (infoOnly) {
    process.exit(infoBefore.body?.ok ? 0 : 1)
  }

  const payload = {
    url: webhookUrl,
    allowed_updates: ['callback_query'],
    drop_pending_updates: false,
  }
  if (secret) payload.secret_token = secret

  const setResult = await tg(token, 'setWebhook', payload)
  console.log('setWebhook:', JSON.stringify(setResult.body, null, 2))

  const infoAfter = await tg(token, 'getWebhookInfo')
  console.log('getWebhookInfo (after):', JSON.stringify(infoAfter.body, null, 2))

  const url = infoAfter.body?.result?.url
  if (!setResult.body?.ok || url !== webhookUrl) {
    console.error('Webhook is not pointing at the expected URL.')
    process.exit(1)
  }

  console.log('OK — Telegram will POST callback_query updates to the Vercel webhook.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
