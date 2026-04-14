import type { CallToolResult } from "@modelcontextprotocol/sdk/types";

import type { SandboxHostContext } from "../react/index.js";

export interface CallToolResponse {
  result: CallToolResult;
  input: Record<string, unknown> | undefined;
}

export interface McpHost {
  connect(url: string): Promise<void>;
  setHostContext(hostContext: Partial<SandboxHostContext>): void;
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<CallToolResponse>;
  teardown(): Promise<void>;
}
