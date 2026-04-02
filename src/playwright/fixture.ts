import { test as base, type FrameLocator } from "@playwright/test";
import type {
  BrowserHostConfig,
  SerializableToolResult,
  RecordedMessage,
  RecordedModelContextUpdate,
  RecordedLogMessage,
} from "../browser/types.js";

const DEFAULT_SANDBOX_URL = "http://127.0.0.1:8081/sandbox.html";
// Harness page served by the sandbox server on localhost (same server,
// different hostname → cross-origin from the sandbox iframe).
// The page includes the host bundle via <script> tag.
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
  getMessages(): Promise<RecordedMessage[]>;
  getModelContextUpdates(): Promise<RecordedModelContextUpdate[]>;
  getLogMessages(): Promise<RecordedLogMessage[]>;
}

export const test = base.extend<{ mcpHost: McpHostFixture }>({
  mcpHost: async ({ page }, use) => {
    // Navigate to the harness page (served by the sandbox server).
    // The page loads the host bundle via <script> tag, making
    // window.__mcpHost available automatically.
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
