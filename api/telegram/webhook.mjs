const STATUS_MARKERS = ['✅ Одобрено', '❌ Отклонено']

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatNow() {
  return new Date().toLocaleString('ru-RU', {
    timeZone: 'Europe/Minsk',
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatActor(user) {
  if (!user) return 'менеджер'
  if (user.username) return `@${user.username}`
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name || `id:${user.id ?? '?'}`
}

async function tgApi(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  return {
    ok: res.ok && Boolean(body.ok),
    status: res.status,
    body,
  }
}

function telegramSafeError(body) {
  if (!body || typeof body !== 'object') return 'unknown Telegram error'
  return body.description || JSON.stringify(body)
}

async function handleCallbackQuery(token, query) {
  const data = String(query?.data || '').trim()
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

  if (STATUS_MARKERS.some((marker) => current.includes(marker))) {
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
  const status = approved ? '✅ Одобрено' : '❌ Отклонено'
  const stamp = formatNow()
  const nextText = `${current.trim()}\n\n────────\n<b>${status}</b>\n👤 ${escapeHtml(actor)}\n🕒 ${escapeHtml(stamp)}`

  const editMethod = isPhoto ? 'editMessageCaption' : 'editMessageText'
  const editPayload = {
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

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    try {
      const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
      const webhookSecret = String(
        process.env.TELEGRAM_WEBHOOK_SECRET || '',
      ).trim()

      if (!token) {
        return json(500, { ok: false, error: 'Bot token missing' })
      }

      if (webhookSecret) {
        const header = request.headers.get('x-telegram-bot-api-secret-token')
        if (header !== webhookSecret) {
          return json(401, { ok: false, error: 'Unauthorized' })
        }
      }

      let update
      try {
        update = await request.json()
      } catch {
        return json(400, { ok: false, error: 'Invalid JSON body' })
      }

      if (update?.callback_query) {
        await handleCallbackQuery(token, update.callback_query)
      }

      return json(200, { ok: true })
    } catch (err) {
      console.error(
        '[order] webhook error:',
        err instanceof Error ? err.stack || err.message : err,
      )
      return json(500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Webhook handler error',
      })
    }
  },
}
