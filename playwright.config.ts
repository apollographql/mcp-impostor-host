import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: [
    {
      command: "node bin/mcp-impostor-host.js",
      url: "http://127.0.0.1:8081/sandbox.html",
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
