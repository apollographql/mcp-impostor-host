import { test as base, type FrameLocator } from "@playwright/test";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types";
import type { McpHost } from "./types.js";

declare global {
  interface Window {
    __mcpHost: McpHost;
  }
}

const DEFAULT_HARNESS_URL = "http://localhost:8080/";

export interface CallToolResponse {
  result: CallToolResult;
  input: Record<string, unknown> | undefined;
  appFrame: FrameLocator;
}

export interface McpHostFixture {
  connect(url: string): Promise<void>;
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<CallToolResponse>;
}

export const test = base.extend<{ mcpHost: McpHostFixture }>({
  mcpHost: async ({ page }, use) => {
    await page.goto(DEFAULT_HARNESS_URL);

    const fixture: McpHostFixture = {
      async connect(url) {
        await page.evaluate((url) => window.__mcpHost.connect(url), url);
      },

      async callTool(name, args) {
        const response = await page.evaluate(
          ({ name, args }) => window.__mcpHost.callTool(name, args),
          { name, args },
        );

        const appFrame = page
          .locator("iframe")
          .contentFrame()
          .locator("iframe")
          .contentFrame();

        return { ...response, appFrame };
      },
    };

    await use(fixture);

    await page.evaluate(() => window.__mcpHost.teardown()).catch(() => {});
  },
});
