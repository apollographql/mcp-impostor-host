import type { CallToolResult } from "@modelcontextprotocol/sdk/types";

export interface CallToolResponse {
  result: CallToolResult;
  input: Record<string, unknown> | undefined;
}

export interface McpHost {
  connect(url: string): Promise<void>;
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<CallToolResponse>;
  teardown(): Promise<void>;
}
