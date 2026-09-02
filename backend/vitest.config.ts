import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Dummy values so importing modules that eagerly read required env vars
    // (src/config/env.ts) doesn't blow up at test-collection time. Never
    // real credentials — anything DB-backed the tests touch is mocked, not
    // a live connection using this URL.
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost:5432/sre_test',
      JWT_SECRET: 'test-secret-not-for-production-use-at-least-32-chars',
      JWT_EXPIRES_IN: '8h',
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
