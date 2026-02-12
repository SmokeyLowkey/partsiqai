import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
    // Database safety check - prevent running integration tests against production
    setupFiles: ['./vitest.setup.ts'],
    // Prevent race conditions in credential tests by ensuring sequential execution
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single worker to prevent parallel execution
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
