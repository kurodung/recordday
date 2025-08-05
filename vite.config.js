import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/', // 👈 สำคัญ
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
  },
})
