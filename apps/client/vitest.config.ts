import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    dir: fileURLToPath(new URL("tests", import.meta.url)),
    root: rootDir,
    environment: "node"
  }
});
