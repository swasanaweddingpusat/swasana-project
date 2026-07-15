import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Exclude pre-existing node:test runner files (not vitest-compatible).
    exclude: ["**/node_modules/**", "lib/attendance-offdays.test.ts"],
    // Money functions are pure — no DB, no setup files.
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
