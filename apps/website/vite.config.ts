import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from 'path';

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
  resolve: {
    alias: {
      '@scss': path.resolve(__dirname, './scss'),
      '@components': path.resolve(__dirname, './lib/components'),
      '@assets': path.resolve(__dirname, './assets'),
      '@app': path.resolve(__dirname, './app'),
      '@hooks': path.resolve(__dirname, './lib/hooks'),
      '@contexts': path.resolve(__dirname, './lib/contexts'),
      '@lib': path.resolve(__dirname, './lib')
    }
  },
  // Shut Up !!!!
  // I Downgraded to sass 1.79.6 so it would shut up
  // See https://github.com/sass/dart-sass/issues/1360#issuecomment-2566423672
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['color-functions', 'legacy-js-api'],
        quietDeps: true,
      },
    },
  },
});
