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

export interface HostConfig {
  uri: string;
  sandboxUrl?: string;
}

export function createHost(config: HostConfig): Host {
  return {
    async connect(): Promise<HostConnection> {
      const client = new Client({
        name: "mcp-impostor-host",
        version: "0.0.1",
      });
      const transport = new StreamableHTTPClientTransport(new URL(config.uri));

      await client.connect(transport);

      const [toolsList, resourcesList] = await Promise.all([
        client.listTools(),
        client.listResources(),
      ]);

      const tools = new Map(toolsList.tools.map((tool) => [tool.name, tool]));
      const resources = new Map(
        resourcesList.resources.map((resource) => [resource.uri, resource])
      );

      return {
        async executeTool(name, args) {
          const result = await client.callTool({ name, arguments: args });

          // TODO: use tools/resources maps to fetch UI resource and mount iframe

          return { result, view: null };
        },

        async [Symbol.asyncDispose]() {
          await client.close();
        },
      };
    },
  };
}
