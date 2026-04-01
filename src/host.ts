import {
  getToolUiResourceUri,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/app-bridge";
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
          const tool = tools.get(name);
          if (!tool) {
            throw new Error(`Unknown tool: "${name}"`);
          }

          const uiResourceUri = getToolUiResourceUri(tool);

          const [callResult, uiResource] = await Promise.all([
            client.callTool({ name, arguments: args }),
            uiResourceUri
              ? client.readResource({ uri: uiResourceUri })
              : Promise.resolve(null),
          ]);

          if (uiResource) {
            const content = uiResource.contents[0];
            if (content?.mimeType !== RESOURCE_MIME_TYPE) {
              throw new Error(
                `Unexpected MIME type for UI resource: "${content?.mimeType}"`
              );
            }
            // TODO: extract HTML, mount iframe (Phase 3)
            void resources;
          }

          return { result: callResult, view: null };
        },

        async [Symbol.asyncDispose]() {
          await client.close();
        },
      };
    },
  };
}
