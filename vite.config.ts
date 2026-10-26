import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Nocturne/' : '/',
  publicDir: false,
  // The imported asset library must share the site's Three.js/TSL runtime.
  resolve: { dedupe: ['three'] },
  build: {
    rollupOptions: {
      input: ['index.html', 'particle.html'],
    },
  },
  server: { host: true },
}))
