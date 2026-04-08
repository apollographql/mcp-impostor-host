import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: [
    {
      command: "node bin/serve-impostor-host.js --playwright",
      url: "http://localhost:8080",
      reuseExistingServer: true,
    },
    {
      command: "npx tsx e2e/mock-server.ts",
      url: "http://localhost:3456/mcp",
      reuseExistingServer: true,
    },
  ],
  use: {
    browserName: "chromium",
  },
});
