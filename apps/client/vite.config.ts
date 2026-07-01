import { defineConfig } from "vite";

export default defineConfig({
  // Load shared monorepo env files from the repository root.
  envDir: "../..",
  server: {
    host: "localhost",
    port: 5173,
    strictPort: true
  }
});
