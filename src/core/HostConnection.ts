import {
  type McpUiResourceCsp,
  type McpUiResourceMeta,
  type McpUiResourcePermissions,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Client } from "@modelcontextprotocol/sdk/client";
import type {
  CallToolResult,
  Resource,
  Tool,
} from "@modelcontextprotocol/sdk/types";

import { invariant, Logger, TypedEventTarget } from "../utilities/index.js";

export declare namespace HostConnection {
  export interface Options {
    tools: Tool[];
    resources: Resource[];
    logger: Logger;
  }

  export interface UiResource {
    html: string;
    csp: McpUiResourceCsp | undefined;
    permissions: McpUiResourcePermissions | undefined;
  }

  export interface Event {
    close: CustomEvent<never>;
  }

  export interface ToolExecution {
    tool: Tool;
    input: Record<string, unknown> | undefined;
    resultPromise: Promise<CallToolResult>;
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

  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): HostConnection.ToolExecution {
    const tool = this.toolsByName.get(name);

    invariant(tool, `Tool not found: '${name}'.`);

    const resultPromise = this.#client.callTool({
      name,
      arguments: args,
    }) as Promise<CallToolResult>;

    return { tool, input: args, resultPromise };
  }

  async close() {
    await this.#client.close();
    this.#closed = true;
    this.dispatchTypedEvent("close", new CustomEvent("close"));
  }

  async getUiResource(uri: string): Promise<HostConnection.UiResource> {
    invariant(
      uri.startsWith("ui://"),
      `Expected a UI resource URI (ui:// scheme). Got: '${uri}'`,
    );

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
