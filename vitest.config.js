import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    alias: {
      '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    testTimeout: 20_000,
  },
});
