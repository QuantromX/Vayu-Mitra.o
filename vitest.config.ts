import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'server.ts',
        'src/lib/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/components/**/*.{ts,tsx}',
      ],
      exclude: ['src/lib/__tests__/**', '**/*.d.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
