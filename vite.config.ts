import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Nocturne/' : '/',
  publicDir: false,
  build: {
    rollupOptions: {
      input: ['index.html', 'particle.html'],
    },
  },
  server: { host: true },
}))
