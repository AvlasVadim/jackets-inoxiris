# InOxiris — RU brochure draft

Vite + React site for embroidered kids’ winter jumpsuits & sets (Витебск, РБ).

## Preview

```bash
npm install
npm run dev
```

http://127.0.0.1:5173/

## Notes

- Orders: form → `POST /api/order` (Vite middleware in `server/telegramOrderPlugin.ts`) → Telegram `sendMessage` / `sendPhoto` with inline Approve/Reject. Callbacks via local `getUpdates` polling (or optional `POST /api/telegram/webhook`). Requires `.env.local` (see `.env.example`). Token never ships to the browser.
- Copy / i18n: `src/i18n/messages.ts` (RU live; EN scaffold hidden).
- Product photos are Instagram placeholders in `public/products/`.
