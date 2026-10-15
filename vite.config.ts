import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build` makes a normal multi-file build (GitHub Pages / Capacitor).
// `npm run build:single` inlines everything into one HTML file for quick sharing.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "single" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "single" ? "dist-single" : "dist",
    chunkSizeWarningLimit: 2000,
  },
}));
