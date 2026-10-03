import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  // Relative asset paths so the static build works on any host path (HashRouter).
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Shared pure helpers owned by Dev A (ADR-12): client/pdas.ts, client/rules.ts.
      "@client": fileURLToPath(new URL("../client", import.meta.url)),
    },
    // client/*.ts lives outside app/, so make its imports resolve to app's single copy.
    dedupe: ["@solana/web3.js", "@anchor-lang/core", "bn.js", "buffer"],
  },
  define: {
    // Some Solana libraries still reference the Node global.
    global: "globalThis",
  },
  optimizeDeps: {
    include: ["buffer"],
  },
  server: {
    fs: {
      // Allow serving ../client during dev.
      allow: [repoRoot],
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
