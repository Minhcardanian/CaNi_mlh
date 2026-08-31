import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { fileURLToPath } from "node:url";

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
  },
  server: {
    host: "127.0.0.1",
    port: 4173,
  },
});
