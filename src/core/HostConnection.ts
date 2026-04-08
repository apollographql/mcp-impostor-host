import {
  getToolUiResourceUri,
  RESOURCE_MIME_TYPE,
  type McpUiResourceCsp,
  type McpUiResourceMeta,
  type McpUiResourcePermissions,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client";
import type { Resource, Tool } from "@modelcontextprotocol/sdk/types";
import { invariant, Logger, TypedEventTarget } from "../utilities/index.js";

export declare namespace HostConnection {
  export interface SandboxConfig {
    url: string;
    selector?: Element;
  }

  export interface Options {
    tools: Tool[];
    resources: Resource[];
    sandbox: SandboxConfig;
    logger: Logger;
  }

  export interface CallToolResult {
    toolResult: Awaited<ReturnType<typeof Client.prototype.callTool>>;
    toolInput: Record<string, any> | undefined;
    uiResource?: HostConnection.UiResource;
  }

  export interface UiResource {
    html: string;
    csp: McpUiResourceCsp | undefined;
    permissions: McpUiResourcePermissions | undefined;
  }

  export interface Event {
    close: CustomEvent<never>;
  }
}

export class HostConnection extends TypedEventTarget<HostConnection.Event> {
  private client: Client;
  private toolsByName = new Map<string, Tool>();
  private resourcesByUri = new Map<string, Resource>();
  private sandbox: HostConnection.SandboxConfig;

  #logger: Logger;

  constructor(client: Client, options: HostConnection.Options) {
    super();
    this.client = client;
    this.sandbox = options.sandbox;
    this.#logger = options.logger;

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
  ): Promise<HostConnection.CallToolResult> {
    const tool = this.toolsByName.get(name);

    invariant(tool, `Tool not found: '${name}'.`);

    const resourceUri = getToolUiResourceUri(tool);

    if (!resourceUri || !resourceUri.startsWith("ui://")) {
      if (!resourceUri?.startsWith("ui://")) {
        this.#logger.warn(
          `The MCP server returned a 'resourceUri' that was not a UI resource. This resource is ignored. Got: '${resourceUri}'`,
        );
      }

      return {
        toolResult: await this.client.callTool({ name, arguments: args }),
        toolInput: args,
      };
    }

    invariant(
      resourceUri && this.sandbox.url,
      "A sandbox url must be configured.",
    );

    const [toolResult, uiResource] = await Promise.all([
      this.client.callTool({ name, arguments: args }),
      this.#getUiResource(resourceUri),
    ]);

    return { toolResult, toolInput: args, uiResource };
  }

  async close() {
    await this.client.close();
    this.dispatchTypedEvent("close", new CustomEvent("close"));
  }

  async #getUiResource(uri: string): Promise<HostConnection.UiResource> {
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

    const meta = (content._meta?.ui ?? resourceDef?._meta?.ui) as
      | McpUiResourceMeta
      | undefined;

    return { html, csp: meta?.csp, permissions: meta?.permissions };
  }
}
