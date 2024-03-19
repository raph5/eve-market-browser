import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from 'path';

export default defineConfig({
  plugins: [remix(), tsconfigPaths()],
  resolve: {
    alias: {
      '@scss': path.resolve(__dirname, './scss'),
      '@components': path.resolve(__dirname, './components'),
      '@app': path.resolve(__dirname, './app')
    }
  }
});
