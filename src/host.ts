import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface ToolResult {
  result: unknown;
  view: HTMLIFrameElement | null;
}

export interface HostConnection {
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  [Symbol.asyncDispose](): Promise<void>;
}

export interface Host {
  connect(): Promise<HostConnection>;
}

export function createHost(config: { uri: string }): Host {
  return {
    async connect(): Promise<HostConnection> {
      const client = new Client({
        name: "mcp-impostor-host",
        version: "0.0.1",
      });
      const transport = new StreamableHTTPClientTransport(new URL(config.uri));

      await client.connect(transport);

      return {
        async executeTool(name, args) {
          const result = await client.callTool({ name, arguments: args });

          // TODO: check result._meta?.ui?.resourceUri, read resource, mount iframe

          return { result, view: null };
        },

        async [Symbol.asyncDispose]() {
          await client.close();
        },
      };
    },
  };
}
