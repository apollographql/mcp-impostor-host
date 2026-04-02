import { test as base, type FrameLocator } from "@playwright/test";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BrowserHostConfig,
  SerializableToolResult,
} from "../browser/types.js";

export type {
  SerializableToolResult,
  CallToolResult,
} from "../browser/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE_PATH = resolve(
  __dirname,
  "..",
  "..",
  "dist",
  "browser",
  "host.bundle.js"
);
const DEFAULT_SANDBOX_URL = "http://127.0.0.1:8081/sandbox.html";
// Harness page served by the sandbox server on localhost (same server,
// different hostname → cross-origin from the sandbox iframe).
const DEFAULT_HARNESS_URL = "http://localhost:8081/";

export interface McpHostConnectConfig {
  uri: string;
  sandboxUrl?: string;
  containerDimensions?: BrowserHostConfig["containerDimensions"];
}

export interface McpToolResult extends SerializableToolResult {
  /** Locator for the inner app frame (inside the sandbox iframe). */
  appFrame: FrameLocator | null;
}

export interface McpHostFixture {
  connect(config: McpHostConnectConfig): Promise<void>;
  executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<McpToolResult>;
  getOpenedLinks(): Promise<string[]>;
}

export const test = base.extend<{ mcpHost: McpHostFixture }>({
  mcpHost: async ({ page }, use) => {
    // Inject the browser bundle — persists across navigations
    await page.addInitScript({ path: BUNDLE_PATH });

    // Navigate to the harness page (served by the sandbox server)
    await page.goto(DEFAULT_HARNESS_URL);

    const fixture: McpHostFixture = {
      async connect(config) {
        const browserConfig: BrowserHostConfig = {
          uri: config.uri,
          sandboxUrl: config.sandboxUrl ?? DEFAULT_SANDBOX_URL,
          containerDimensions: config.containerDimensions,
        };
        await page.evaluate(
          (cfg) =>
            (
              window as unknown as {
                __mcpHost: { connect: (c: unknown) => Promise<void> };
              }
            ).__mcpHost.connect(cfg),
          browserConfig
        );
      },

      async executeTool(name, args) {
        const serializable = await page.evaluate(
          ({ name, args }) =>
            (
              window as unknown as {
                __mcpHost: {
                  executeTool: (
                    n: string,
                    a: Record<string, unknown>
                  ) => Promise<SerializableToolResult>;
                };
              }
            ).__mcpHost.executeTool(name, args),
          { name, args }
        );

        const appFrame = serializable.hasView
          ? page
              .locator("iframe")
              .contentFrame()
              .locator("iframe")
              .contentFrame()
          : null;

        return { ...serializable, appFrame };
      },

      async getOpenedLinks() {
        return page.evaluate(() =>
          (
            window as unknown as {
              __mcpHost: { getOpenedLinks: () => string[] };
            }
          ).__mcpHost.getOpenedLinks()
        );
      },
    };

    await use(fixture);

    await page
      .evaluate(() =>
        (
          window as unknown as {
            __mcpHost?: { teardown: () => Promise<void> };
          }
        ).__mcpHost?.teardown()
      )
      .catch(() => {});
  },
});
