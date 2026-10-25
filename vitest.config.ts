import {configDefaults, defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {name: 'node', environment: 'node', include: ['**/*.node.test.ts']}
      },
      {
        extends: true,
        test: {
          name: 'browser',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          exclude: [...configDefaults.exclude, '**/*.node.test.ts']
        }
      }
    ]
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  }
});
