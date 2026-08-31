import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react(), wasm()],
  publicDir: "../midnight-contract/src/managed/nightpermit",
  resolve: {
    alias: [
      { find: /^assert$/, replacement: "assert/" },
      { find: /^events$/, replacement: "events/" },
      {
        find: /^isomorphic-ws$/,
        replacement: fileURLToPath(new URL("./src/browser-websocket.ts", import.meta.url)),
      },
    ],
  },
  build: {
    manifest: true,
    target: "esnext",
    sourcemap: true,
    rollupOptions: {
      input: {
        app: resolve(import.meta.dirname, "index.html"),
        deploy: resolve(import.meta.dirname, "deploy.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});
