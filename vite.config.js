import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const base = command === 'serve'
    ? '/'
    : (process.env.VITE_BASE_PATH || '/moonspell-sat/');

  return {
    base,
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
  };
})
