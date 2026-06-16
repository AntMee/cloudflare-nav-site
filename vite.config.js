import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "esbuild",
    sourcemap: false,
    cssMinify: true,
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[hash].js",
        chunkFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]"
      }
    }
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
