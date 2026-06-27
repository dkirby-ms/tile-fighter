import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@game/shared-auth": fileURLToPath(new URL("../../packages/shared-auth/src/index.ts", import.meta.url)),
      "@game/shared-persistence": fileURLToPath(
        new URL("../../packages/shared-persistence/src/index.ts", import.meta.url)
      ),
      "@game/shared-types": fileURLToPath(new URL("../../packages/shared-types/src/index.ts", import.meta.url))
    }
  },
  test: {
    dir: fileURLToPath(new URL("tests", import.meta.url)),
    root: rootDir,
    environment: "node"
  }
});