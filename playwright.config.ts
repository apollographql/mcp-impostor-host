import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: [
    {
      command: "node bin/serve-impostor-host.js --playwright",
      url: "http://localhost:8080",
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npx tsx e2e/mock-server.ts",
      url: "http://localhost:3456",
      reuseExistingServer: !process.env.CI,
    },
  ],
  workers: process.env.CI ? 1 : undefined,
  use: {
    browserName: "chromium",
  },
});
