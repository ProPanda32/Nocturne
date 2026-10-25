import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Nocturne/' : '/',
  publicDir: false,
  server: { host: true },
})
