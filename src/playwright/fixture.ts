import { test as base, type FrameLocator } from "@playwright/test";
import type {
  BrowserHostConfig,
  SerializableToolResult,
  RecordedMessage,
  RecordedModelContextUpdate,
  RecordedLogMessage,
} from "../browser/types.js";

// The sandbox server listens on a single port but serves two roles:
//
// 1. Harness page at http://localhost:{port}/
//    Loads the host bundle, provides window.__mcpHost for manual
//    and automated testing.
//
// 2. Sandbox iframe at http://127.0.0.1:{port}/sandbox.html
//    Runs the sandbox proxy with CSP enforcement.
//
// Using different hostnames (localhost vs 127.0.0.1) on the same port
// gives us cross-origin isolation between the harness and sandbox,
// which the MCP Apps spec requires.
const DEFAULT_HARNESS_URL = "http://localhost:8081/";
const DEFAULT_SANDBOX_URL = "http://127.0.0.1:8081/sandbox.html";

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
  getMessages(): Promise<RecordedMessage[]>;
  getModelContextUpdates(): Promise<RecordedModelContextUpdate[]>;
  getLogMessages(): Promise<RecordedLogMessage[]>;
}

export const test = base.extend<{ mcpHost: McpHostFixture }>({
  mcpHost: async ({ page }, use) => {
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

        const appFrame =
          serializable.hasView ?
            page
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

      async getMessages() {
        return page.evaluate(() =>
          (
            window as unknown as {
              __mcpHost: { getMessages: () => RecordedMessage[] };
            }
          ).__mcpHost.getMessages()
        );
      },

      async getModelContextUpdates() {
        return page.evaluate(() =>
          (
            window as unknown as {
              __mcpHost: {
                getModelContextUpdates: () => RecordedModelContextUpdate[];
              };
            }
          ).__mcpHost.getModelContextUpdates()
        );
      },

      async getLogMessages() {
        return page.evaluate(() =>
          (
            window as unknown as {
              __mcpHost: { getLogMessages: () => RecordedLogMessage[] };
            }
          ).__mcpHost.getLogMessages()
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
