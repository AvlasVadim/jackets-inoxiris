const STATUS_MARKERS = ['✅ Одобрено', '❌ Отклонено']
const WEBHOOK_URL = 'https://jackets-inoxiris.vercel.app/api/telegram/webhook'

/** Inline statuses for topic «Отправка товара» (TELEGRAM_SHIPPING_THREAD_ID). */
const SHIPPING_KB = {
  inline_keyboard: [
    [
      { text: 'В сборке', callback_data: 'ship:pack' },
      { text: 'Отправлено', callback_data: 'ship:sent' },
      { text: 'Доставлено', callback_data: 'ship:done' },
    ],
    [
      { text: 'Проблема', callback_data: 'ship:issue' },
      { text: 'Отмена', callback_data: 'ship:cancel' },
    ],
  ],
}

const SHIPPING_STATUSES = {
  'ship:pack': { label: 'В сборке', marker: '📦 В сборке' },
  'ship:sent': { label: 'Отправлено', marker: '🚚 Отправлено' },
  'ship:done': { label: 'Доставлено', marker: '📬 Доставлено' },
  'ship:issue': { label: 'Проблема', marker: '⚠️ Проблема' },
  'ship:cancel': { label: 'Отмена', marker: '🚫 Отмена' },
}

const SHIPPING_STATUS_FOOTER_RE =
  /\n\n────────\n(?:<b>)?(?:📦 В сборке|🚚 Отправлено|📬 Доставлено|⚠️ Проблема|🚫 Отмена)(?:<\/b>)?(?:\n[\s\S]*)?$/

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

function isThreadError(body) {
  const err = telegramSafeError(body).toLowerCase()
  return (
    err.includes('thread') ||
    err.includes('topic') ||
    err.includes('message_thread_id')
  )
}

function parseApproverIds(raw) {
  return String(raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Empty whitelist denies Approve/Reject and shipping-status presses until
 * TELEGRAM_APPROVER_IDS is set.
 */
function checkApproverAccess(query) {
  const ids = parseApproverIds(process.env.TELEGRAM_APPROVER_IDS)
  if (ids.length === 0) {
    return {
      ok: false,
      text: 'Вайтлист пуст. Задайте TELEGRAM_APPROVER_IDS',
    }
  }
  const userId =
    query?.from?.id != null ? String(query.from.id) : ''
  if (!userId || !ids.includes(userId)) {
    return { ok: false, text: 'Нет доступа' }
  }
  return { ok: true }
}

/** Always answer so Telegram stops the button spinner (even on errors). */
async function answerCallbackQuery(token, queryId, opts = {}) {
  if (!token || !queryId) return { ok: false, skipped: true }
  try {
    const payload = { callback_query_id: queryId }
    if (opts.text) payload.text = opts.text
    if (opts.show_alert) payload.show_alert = true
    const result = await tgApi(token, 'answerCallbackQuery', payload)
    if (!result.ok) {
      console.error(
        '[order] answerCallbackQuery failed:',
        telegramSafeError(result.body),
      )
    }
    return result
  } catch (err) {
    console.error(
      '[order] answerCallbackQuery threw:',
      err instanceof Error ? err.message : err,
    )
    return { ok: false }
  }
}

function applyShippingStatus(original, marker) {
  const base = String(original || '')
    .replace(SHIPPING_STATUS_FOOTER_RE, '')
    .trim()
  return `${base}\n\n────────\n<b>${marker}</b>`
}

function largestPhotoFileId(photo) {
  if (!Array.isArray(photo) || photo.length === 0) return null
  const last = photo[photo.length - 1]
  return last?.file_id || null
}

/**
 * Post a fresh product/client card into «Отправка товара» (no approver stamp).
 * Uses the same photo file_id when the approved message had a photo.
 */
async function postShippingCard(token, message, baseText) {
  const shippingThreadId = String(
    process.env.TELEGRAM_SHIPPING_THREAD_ID || '',
  ).trim()
  if (!shippingThreadId) {
    console.warn(
      '[order] TELEGRAM_SHIPPING_THREAD_ID missing — skip shipping card',
    )
    return
  }

  const chatId = message.chat.id
  const fileId = largestPhotoFileId(message.photo)
  const caption = String(baseText || '').trim()

  async function deliver(withThread) {
    const thread = withThread ? Number(shippingThreadId) : undefined
    if (fileId) {
      const payload = {
        chat_id: chatId,
        photo: fileId,
        caption,
        parse_mode: 'HTML',
        reply_markup: SHIPPING_KB,
      }
      if (thread != null) payload.message_thread_id = thread
      return tgApi(token, 'sendPhoto', payload)
    }
    const payload = {
      chat_id: chatId,
      text: caption,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: SHIPPING_KB,
    }
    if (thread != null) payload.message_thread_id = thread
    return tgApi(token, 'sendMessage', payload)
  }

  let result = await deliver(true)
  if (!result.ok && isThreadError(result.body)) {
    console.warn(
      '[order] shipping thread rejected; retrying without message_thread_id',
    )
    result = await deliver(false)
  }
  if (!result.ok) {
    console.error(
      '[order] shipping card send failed:',
      telegramSafeError(result.body),
    )
  }
}

async function editDecisionMessage(token, query, approved) {
  const message = query.message
  if (!message) {
    return { ok: false, text: 'Сообщение недоступно', show_alert: true }
  }

  const isPhoto = Array.isArray(message.photo) && message.photo.length > 0
  const current = isPhoto ? message.caption || '' : message.text || ''

  if (STATUS_MARKERS.some((marker) => current.includes(marker))) {
    await tgApi(token, 'editMessageReplyMarkup', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: { inline_keyboard: [] },
    })
    return { ok: true, text: 'Заявка уже обработана', show_alert: true }
  }

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
    return { ok: false, text: 'Не удалось обновить заявку', show_alert: true }
  }

  // Reject path unchanged: only approved orders get a shipping-topic card.
  if (approved) {
    try {
      await postShippingCard(token, message, current)
    } catch (err) {
      console.error(
        '[order] shipping card after approve failed:',
        err instanceof Error ? err.stack || err.message : err,
      )
    }
  }

  return {
    ok: true,
    text: approved ? 'Одобрено' : 'Отклонено',
  }
}

async function editShippingStatusMessage(token, query, status) {
  const message = query.message
  if (!message) {
    return { ok: false, text: 'Сообщение недоступно', show_alert: true }
  }

  const isPhoto = Array.isArray(message.photo) && message.photo.length > 0
  const current = isPhoto ? message.caption || '' : message.text || ''
  const nextText = applyShippingStatus(current, status.marker)

  const editMethod = isPhoto ? 'editMessageCaption' : 'editMessageText'
  const editPayload = {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'HTML',
    reply_markup: SHIPPING_KB,
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
      '[order] shipping status edit failed:',
      telegramSafeError(edited.body),
    )
    return { ok: false, text: 'Не удалось обновить статус', show_alert: true }
  }

  return { ok: true, text: status.label }
}

async function handleCallbackQuery(token, query) {
  const queryId = query?.id
  // Answer immediately with a neutral ack so the client spinner stops even if
  // later edit/whitelist work is slow or throws. Telegram allows one answer;
  // a second answerCallbackQuery is ignored — so we answer once here with the
  // final user-facing text after fast checks, before slow edits when possible.
  //
  // Strategy: run fast auth/parse first (<1ms), answer with final toast, THEN edit.
  // On unexpected throw, still attempt a fallback answer in the outer catch.

  const data = String(query?.data || '').trim()
  const shippingStatus = SHIPPING_STATUSES[data]

  if (shippingStatus) {
    const access = checkApproverAccess(query)
    if (!access.ok) {
      await answerCallbackQuery(token, queryId, {
        text: access.text,
        show_alert: true,
      })
      return
    }

    const preview = query.message
    if (!preview) {
      await answerCallbackQuery(token, queryId, {
        text: 'Сообщение недоступно',
        show_alert: true,
      })
      return
    }

    await answerCallbackQuery(token, queryId, {
      text: shippingStatus.label,
    })

    try {
      await editShippingStatusMessage(token, query, shippingStatus)
    } catch (err) {
      console.error(
        '[order] shipping edit after answered callback failed:',
        err instanceof Error ? err.stack || err.message : err,
      )
    }
    return
  }

  if (data !== 'ord:ok' && data !== 'ord:no') {
    await answerCallbackQuery(token, queryId, {
      text: 'Неизвестная команда',
      show_alert: true,
    })
    return
  }

  const access = checkApproverAccess(query)
  if (!access.ok) {
    await answerCallbackQuery(token, queryId, {
      text: access.text,
      show_alert: true,
    })
    return
  }

  const approved = data === 'ord:ok'
  const preview = query.message
  if (!preview) {
    await answerCallbackQuery(token, queryId, {
      text: 'Сообщение недоступно',
      show_alert: true,
    })
    return
  }

  const currentText =
    Array.isArray(preview.photo) && preview.photo.length > 0
      ? preview.caption || ''
      : preview.text || ''
  const already = STATUS_MARKERS.some((marker) => currentText.includes(marker))

  // Answer BEFORE editing so a slow/failed edit cannot leave the spinner spinning.
  await answerCallbackQuery(token, queryId, {
    text: already
      ? 'Заявка уже обработана'
      : approved
        ? 'Одобрено'
        : 'Отклонено',
    show_alert: already,
  })

  try {
    await editDecisionMessage(token, query, approved)
  } catch (err) {
    console.error(
      '[order] edit after answered callback failed:',
      err instanceof Error ? err.stack || err.message : err,
    )
  }
}

export default {
  async fetch(request) {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return json(200, {
        ok: true,
        service: 'telegram-webhook',
        webhookUrl: WEBHOOK_URL,
        hint: 'Telegram must POST updates here. Run scripts/set-telegram-webhook.mjs or setWebhook.',
      })
    }

    if (request.method !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    let token = ''
    let callbackQueryId = ''

    try {
      token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim()
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

      callbackQueryId = update?.callback_query?.id
        ? String(update.callback_query.id)
        : ''

      if (update?.callback_query) {
        await handleCallbackQuery(token, update.callback_query)
      }

      return json(200, { ok: true })
    } catch (err) {
      console.error(
        '[order] webhook error:',
        err instanceof Error ? err.stack || err.message : err,
      )
      // Last-resort: stop the Telegram spinner even when the handler blows up.
      if (token && callbackQueryId) {
        await answerCallbackQuery(token, callbackQueryId, {
          text: 'Ошибка обработки',
          show_alert: true,
        })
      }
      return json(500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Webhook handler error',
      })
    }
  },
}
