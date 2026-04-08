import {
  getToolUiResourceUri,
  RESOURCE_MIME_TYPE,
  type McpUiResourceCsp,
  type McpUiResourceMeta,
  type McpUiResourcePermissions,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client";
import type { Resource, Tool } from "@modelcontextprotocol/sdk/types";
import { invariant } from "../utilities/index.js";

type ClientCallToolResult = Awaited<
  ReturnType<typeof Client.prototype.callTool>
>;

interface UiResource {
  html: string;
  csp: McpUiResourceCsp | undefined;
  permissions: McpUiResourcePermissions | undefined;
}

export declare namespace HostConnection {
  export interface SandboxConfig {
    url: string;
    selector?: Element;
  }

  export interface Options {
    tools: Tool[];
    resources: Resource[];
    sandbox: SandboxConfig;
  }
}

export class HostConnection {
  private client: Client;
  private toolsByName = new Map<string, Tool>();
  private resourcesByUri = new Map<string, Resource>();
  private sandbox: HostConnection.SandboxConfig;

  constructor(client: Client, options: HostConnection.Options) {
    this.client = client;
    this.sandbox = options.sandbox;

    for (const tool of options.tools) {
      this.toolsByName.set(tool.name, tool);
    }

    for (const resource of options.resources) {
      this.resourcesByUri.set(resource.uri, resource);
    }
  }

  async callTool(
    name: string,
    args?: Record<string, any>,
  ): Promise<ClientCallToolResult> {
    const tool = this.toolsByName.get(name);

    invariant(tool, `Tool not found: '${name}'.`);

    const resourceUri = getToolUiResourceUri(tool);

    // MCP Apps require a `ui://` uri. If we get something different, we ignore
    // it move on.
    if (!resourceUri || !resourceUri.startsWith("ui://")) {
      return this.client.callTool({ name, arguments: args });
    }

    invariant(
      resourceUri && this.sandbox.url,
      "A sandbox url must be configured.",
    );

    const [toolResult, uiResource] = await Promise.all([
      this.client.callTool({ name, arguments: args }),
      this.#getUiResource(resourceUri),
    ]);

    return toolResult;
  }

  async #getUiResource(uri: string): Promise<UiResource> {
    const resource = await this.client.readResource({ uri });

    invariant(resource, `Resource not found: '${uri}'.`);
    invariant(
      resource.contents.length === 1,
      `Expected resource to contain exactly 1 content item. Got ${resource.contents.length}.`,
    );

    const content = resource.contents[0]!;

    invariant(
      content.mimeType === RESOURCE_MIME_TYPE,
      `Unexpected mime type for resource: '${content.mimeType}'.`,
    );

    const html = "blob" in content ? atob(content.blob) : content.text;
    const resourceDef = this.resourcesByUri.get(uri);

    const uiMeta = (content._meta?.ui ?? resourceDef?._meta?.ui) as
      | McpUiResourceMeta
      | undefined;

    return { html, csp: uiMeta?.csp, permissions: uiMeta?.permissions };
  }
}
