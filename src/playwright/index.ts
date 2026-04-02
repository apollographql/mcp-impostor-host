import { test as base } from "@playwright/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BrowserHostConfig,
  SerializableToolResult,
} from "../browser/types.js";

export type { SerializableToolResult, CallToolResult } from "../browser/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = resolve(__dirname, "..", "..", "dist", "browser", "host.bundle.js");
const HARNESS_ORIGIN = "http://localhost:9876";
const DEFAULT_SANDBOX_URL = "http://127.0.0.1:8081/sandbox.html";

export interface McpHostConnectConfig {
  uri: string;
  sandboxUrl?: string;
  containerDimensions?: BrowserHostConfig["containerDimensions"];
}

export interface McpHostFixture {
  connect(config: McpHostConnectConfig): Promise<void>;
  executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<SerializableToolResult>;
  getOpenedLinks(): Promise<string[]>;
}

export const test = base.extend<{ mcpHost: McpHostFixture }>({
  mcpHost: async ({ page }, use) => {
    await page.route(`${HARNESS_ORIGIN}/**`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!DOCTYPE html><html><head></head><body></body></html>",
      });
    });

    await page.addInitScript({ path: BUNDLE_PATH });
    await page.goto(`${HARNESS_ORIGIN}/`);

    const fixture: McpHostFixture = {
      async connect(config) {
        const browserConfig: BrowserHostConfig = {
          uri: config.uri,
          sandboxUrl: config.sandboxUrl ?? DEFAULT_SANDBOX_URL,
          containerDimensions: config.containerDimensions,
        };
        await page.evaluate(
          (cfg) =>
            (window as unknown as { __mcpHost: { connect: (c: unknown) => Promise<void> } }).__mcpHost.connect(cfg),
          browserConfig
        );
      },

      async executeTool(name, args) {
        return page.evaluate(
          ({ name, args }) =>
            (window as unknown as { __mcpHost: { executeTool: (n: string, a: Record<string, unknown>) => Promise<SerializableToolResult> } }).__mcpHost.executeTool(name, args),
          { name, args }
        );
      },

      async getOpenedLinks() {
        return page.evaluate(
          () =>
            (window as unknown as { __mcpHost: { getOpenedLinks: () => string[] } }).__mcpHost.getOpenedLinks()
        );
      },
    };

    await use(fixture);

    await page
      .evaluate(
        () =>
          (window as unknown as { __mcpHost?: { teardown: () => Promise<void> } }).__mcpHost?.teardown()
      )
      .catch(() => {});
  },
});
