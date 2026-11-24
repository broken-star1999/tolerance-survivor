import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    lib: {
      entry: 'src/main.ts',
      name: 'ToleranceSurvivor',
      formats: ['iife'],
      fileName: () => 'game.js',
    },
  },
})
