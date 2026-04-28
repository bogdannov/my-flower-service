import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ["./tests/integration/setup/global-setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Integration test files share one LocalStack instance — run sequentially to avoid table clears
    // in one file's beforeEach interfering with another file's in-flight operations.
    fileParallelism: false,
  },
});
