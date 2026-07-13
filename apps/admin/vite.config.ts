/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/account': 'http://127.0.0.1:8080',
			'/api/admin': {
				target: 'http://127.0.0.1:8082',
				headers: {
					'X-HHC-User-ID': 'local-admin',
					'X-HHC-Auth-Provider': 'account-api',
					'X-HHC-Scopes': 'cms:read cms:write cms:publish assets:read assets:write assets:grant',
				},
			},
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
