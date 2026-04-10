import type {
  McpUiMessageRequest,
  McpUiOpenLinkRequest,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types";
import { type FrameLocator, test as base } from "@playwright/test";

import type { McpHost } from "./types.js";
import type { Host } from "../core/index.js";

declare global {
  interface Window {
    __mcpHost: McpHost;
  }
}

const DEFAULT_HARNESS_URL = "http://localhost:8080/";
const DEFAULT_MESSAGE_TIMEOUT = 5000;

export interface CallToolResponse {
  result: CallToolResult;
  input: Record<string, unknown> | undefined;
  appFrame: FrameLocator;
}

export interface McpHostConnection {
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<CallToolResponse>;
  readonly messageRequests: ReadonlyArray<McpUiMessageRequest["params"]>;
  waitForMessageRequest(options?: {
    /**
     * Amount of time in milliseconds before the call times out.
     *
     * @default 5000
     */
    timeout?: number;
  }): Promise<McpUiMessageRequest["params"]>;
  readonly openLinkRequests: ReadonlyArray<McpUiOpenLinkRequest["params"]>;
  waitForOpenLinkRequest(options?: {
    /**
     * Amount of time in milliseconds before the call times out.
     *
     * @default 5000
     */
    timeout?: number;
  }): Promise<McpUiOpenLinkRequest["params"]>;
}

export interface McpHostFixture {
  connect(options: Host.ConnectOptions): Promise<McpHostConnection>;
}

export const test = base.extend<{ mcpHost: McpHostFixture }>({
  mcpHost: async ({ page }, use) => {
    await page.goto(DEFAULT_HARNESS_URL);

    const messageRequests: McpUiMessageRequest["params"][] = [];
    let controller: ReadableStreamDefaultController<
      McpUiMessageRequest["params"]
    >;

    const stream = new ReadableStream<McpUiMessageRequest["params"]>({
      start(c) {
        controller = c;
      },
    });

    const reader = stream.getReader();

    const openLinkRequests: McpUiOpenLinkRequest["params"][] = [];
    let openLinkController: ReadableStreamDefaultController<
      McpUiOpenLinkRequest["params"]
    >;

    const openLinkStream = new ReadableStream<McpUiOpenLinkRequest["params"]>({
      start(c) {
        openLinkController = c;
      },
    });

    const openLinkReader = openLinkStream.getReader();

    await page.exposeFunction(
      "__playwrightPushMessage",
      (params: McpUiMessageRequest["params"]) => {
        messageRequests.push(params);
        controller.enqueue(params);
      },
    );

    await page.exposeFunction(
      "__playwrightSendOpenLinkRequest",
      (params: McpUiOpenLinkRequest["params"]) => {
        openLinkRequests.push(params);
        openLinkController.enqueue(params);
      },
    );

    const fixture: McpHostFixture = {
      async connect(options) {
        await page.evaluate(
          (url) => window.__mcpHost.connect(url),
          options.url,
        );

        return {
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

          get messageRequests() {
            return messageRequests;
          },

          waitForMessageRequest(options) {
            let timer: ReturnType<typeof setTimeout>;

            return Promise.race([
              reader.read().then(({ value }) => {
                clearTimeout(timer);
                return value!;
              }),
              new Promise<never>((_, reject) => {
                const timeout = options?.timeout ?? DEFAULT_MESSAGE_TIMEOUT;

                timer = setTimeout(
                  () =>
                    reject(
                      new Error(
                        `[@apollo/mcp-impostor-host:playwright] Timeout waiting for message request.`,
                      ),
                    ),
                  timeout,
                );
              }),
            ]);
          },

          get openLinkRequests() {
            return openLinkRequests;
          },

          waitForOpenLinkRequest(options) {
            let timer: ReturnType<typeof setTimeout>;

            return Promise.race([
              openLinkReader.read().then(({ value }) => {
                clearTimeout(timer);
                return value!;
              }),
              new Promise<never>((_, reject) => {
                const timeout = options?.timeout ?? DEFAULT_MESSAGE_TIMEOUT;

                timer = setTimeout(
                  () =>
                    reject(
                      new Error(
                        `[@apollo/mcp-impostor-host:playwright] Timeout waiting for open link request.`,
                      ),
                    ),
                  timeout,
                );
              }),
            ]);
          },
        };
      },
    };

    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(fixture);

    await page.evaluate(() => window.__mcpHost.teardown()).catch(() => {});
  },
});
