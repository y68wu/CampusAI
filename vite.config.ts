import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: ".",
  base: process.env.VITE_BASE_PATH ?? "/",
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/graphql": "http://localhost:4000",
      "/api": "http://localhost:4000",
      "/mcp": "http://localhost:4000",
    },
  },
});
