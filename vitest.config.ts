import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'release', 'build'],
    coverage: {
      provider: 'vitest',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'release/',
        'build/',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
        'src/test/',
        'src/main/starter_modules/',
      ],
    },
    // Allow TypeScript imports without extensions
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './src/types'),
      '@dashboard': path.resolve(__dirname, './src/dashboard'),
      '@projector': path.resolve(__dirname, './src/projector'),
      '@shared': path.resolve(__dirname, './src/shared'),
      // Alias webmidi and osc to their mock files for testing
      'webmidi': path.resolve(__dirname, './__mocks__/webmidi.js'),
      'osc': path.resolve(__dirname, './__mocks__/osc.js'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@types': path.resolve(__dirname, './src/types'),
      '@dashboard': path.resolve(__dirname, './src/dashboard'),
      '@projector': path.resolve(__dirname, './src/projector'),
      '@shared': path.resolve(__dirname, './src/shared'),
      // Alias webmidi and osc to their mock files for testing
      'webmidi': path.resolve(__dirname, './__mocks__/webmidi.js'),
      'osc': path.resolve(__dirname, './__mocks__/osc.js'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'],
  },
  // Transform all TS files
  transformMode: {
    web: [/\.(tsx?|jsx)$/],
    ssr: [/\.(tsx?|jsx)$/],
  },
});
