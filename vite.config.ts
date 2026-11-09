import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { telegramOrderPlugin } from './server/telegramOrderPlugin'

export default defineConfig({
  plugins: [react(), telegramOrderPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
