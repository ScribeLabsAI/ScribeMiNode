import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      all: true,
      provider: 'v8',
      reporter: ['clover', 'text'],
      include: ['src/**'],
      enabled: true,
    },
    testTimeout: 20_000,
  },
});
