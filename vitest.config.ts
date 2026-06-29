import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Unit tests run in the Node environment (main-process logic only). The
// renderer isn't covered here. `@shared` mirrors the electron-vite alias so
// main-process modules resolve their type imports the same way.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
