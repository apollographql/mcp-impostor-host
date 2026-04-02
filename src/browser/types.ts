import type { HostConfig } from "../host.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface BrowserHostConfig {
  uri: string;
  sandboxUrl: string;
  containerDimensions?: HostConfig["containerDimensions"];
}

export interface SerializableToolResult {
  result: CallToolResult;
  hasView: boolean;
}

export interface McpHostBrowserAPI {
  connect(config: BrowserHostConfig): Promise<void>;
  executeTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<SerializableToolResult>;
  getOpenedLinks(): string[];
  teardown(): Promise<void>;
}
