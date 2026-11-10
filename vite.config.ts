import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// base './' — zbudowany katalog dist/ działa pod dowolną podścieżką,
// np. wrzucony do public/atrium-poludnie/ innej strony.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
