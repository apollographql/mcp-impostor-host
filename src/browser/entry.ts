import { createHost, type HostConnection } from "../host.js";
import type { McpHostBrowserAPI, BrowserHostConfig, SerializableToolResult } from "./types.js";

let connection: HostConnection | null = null;

const api: McpHostBrowserAPI = {
  async connect(config: BrowserHostConfig): Promise<void> {
    if (connection) {
      throw new Error(
        "Already connected. Call teardown() before connecting again."
      );
    }

    const host = createHost({
      uri: config.uri,
      sandboxUrl: config.sandboxUrl,
      containerDimensions: config.containerDimensions,
    });

    connection = await host.connect();
  },

  async executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<SerializableToolResult> {
    if (!connection) {
      throw new Error("Not connected. Call connect() first.");
    }

    const { result, view } = await connection.executeTool(name, args);
    return { result, hasView: view !== null };
  },

  getOpenedLinks(): string[] {
    if (!connection) return [];
    return [...connection.openedLinks];
  },

  async teardown(): Promise<void> {
    if (connection) {
      await connection.teardown();
      connection = null;
    }
  },
};

(window as unknown as { __mcpHost: McpHostBrowserAPI }).__mcpHost = api;
