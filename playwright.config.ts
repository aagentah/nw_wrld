import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  workers: process.env.CI ? 1 : 6,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 3,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
