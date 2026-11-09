# InOxiris — RU brochure draft

Vite + React site for embroidered kids’ winter jumpsuits & sets (Витебск, РБ).

## Preview

```bash
npm install
npm run dev
```

http://127.0.0.1:5173/

## Notes

- Orders: form → `POST /api/order` (Vite middleware in `server/telegramOrderPlugin.ts`; on Vercel `api/order.mjs`) → Telegram `sendMessage` / `sendPhoto` with inline Approve/Reject.
- **Local:** callbacks via `getUpdates` polling. Requires `.env.local` (see `.env.example`).
- **Prod (Vercel):** Telegram must `setWebhook` to `https://jackets-inoxiris.vercel.app/api/telegram/webhook` (`api/telegram/webhook.mjs`). Without that URL registered, Approve/Reject buttons spin forever. Register/verify:
  ```bash
  TELEGRAM_BOT_TOKEN='…' node scripts/set-telegram-webhook.mjs
  TELEGRAM_BOT_TOKEN='…' node scripts/set-telegram-webhook.mjs --info
  ```
  Or: `curl -sS "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://jackets-inoxiris.vercel.app/api/telegram/webhook" -d 'allowed_updates=["callback_query"]'`. Token never ships to the browser; keep it only in Vercel env / local shell.
- Copy / i18n: `src/i18n/messages.ts` (RU live; EN scaffold hidden).
- Product photos are Instagram placeholders in `public/products/`.
