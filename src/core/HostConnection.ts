import {
  getToolUiResourceUri,
  RESOURCE_MIME_TYPE,
  type McpUiResourceCsp,
  type McpUiResourceMeta,
  type McpUiResourcePermissions,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client";
import type {
  Resource,
  Tool,
  CallToolResult as SdkCallToolResult,
  CallToolResult,
} from "@modelcontextprotocol/sdk/types";
import { invariant, Logger, TypedEventTarget } from "../utilities/index.js";

export declare namespace HostConnection {
  export interface Options {
    tools: Tool[];
    resources: Resource[];
    logger: Logger;
  }

  export interface CallToolResult {
    result: SdkCallToolResult;
    input: Record<string, any> | undefined;
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
  #client: Client;
  private toolsByName = new Map<string, Tool>();
  private resourcesByUri = new Map<string, Resource>();

  #logger: Logger;
  #closed = false;

  constructor(client: Client, options: HostConnection.Options) {
    super();
    this.#client = client;
    this.#logger = options.logger;

    for (const tool of options.tools) {
      this.toolsByName.set(tool.name, tool);
    }

    for (const resource of options.resources) {
      this.resourcesByUri.set(resource.uri, resource);
    }
  }

  /** @internal */
  get client() {
    return this.#client;
  }

  get closed() {
    return this.#closed;
  }

  get logger() {
    return this.#logger;
  }

  async callTool(
    name: string,
    args?: Record<string, any>,
  ): Promise<HostConnection.CallToolResult> {
    const tool = this.toolsByName.get(name);

    invariant(tool, `Tool not found: '${name}'.`);

    const resourceUri = getToolUiResourceUri(tool);

    const resultPromise = this.#client.callTool({
      name,
      arguments: args,
    }) as Promise<SdkCallToolResult>;

    if (!resourceUri || !resourceUri.startsWith("ui://")) {
      if (!resourceUri?.startsWith("ui://")) {
        this.#logger.warn(
          `The MCP server returned a 'resourceUri' that was not a UI resource. This resource is ignored. Got: '${resourceUri}'`,
        );
      }

      return { result: await resultPromise, input: args };
    }

    const [result, uiResource] = await Promise.all([
      resultPromise,
      this.#getUiResource(resourceUri),
    ]);

    return { result, input: args, uiResource };
  }

  async close() {
    await this.#client.close();
    this.#closed = true;
    this.dispatchTypedEvent("close", new CustomEvent("close"));
  }

  async #getUiResource(uri: string): Promise<HostConnection.UiResource> {
    const resource = await this.#client.readResource({ uri });

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
