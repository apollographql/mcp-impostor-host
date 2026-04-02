import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  webServer: {
    command: "node bin/mcp-impostor-host.js",
    url: "http://127.0.0.1:8081/sandbox.html",
    reuseExistingServer: true,
  },
  use: {
    browserName: "chromium",
  },
});
