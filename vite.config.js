import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/moonspell-sat/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        admin: resolve('admin.html'),
        local: resolve('local-site.html'),
      },
    },
  },
})
