import type { Client } from "@modelcontextprotocol/sdk/client";
import type { Resource, Tool } from "@modelcontextprotocol/sdk/types";

export declare namespace HostConnection {
  export interface Options {
    tools: Tool[];
    resources: Resource[];
  }
}

export class HostConnection {
  private client: Client;
  private toolsByName = new Map<string, Tool>();
  private resourcesByUri = new Map<string, Resource>();

  constructor(client: Client, options: HostConnection.Options) {
    this.client = client;

    for (const tool of options.tools) {
      this.toolsByName.set(tool.name, tool);
    }

    for (const resource of options.resources) {
      this.resourcesByUri.set(resource.uri, resource);
    }
  }

  async executeTool(name: string, args?: Record<string, any>) {
    const tool = this.toolsByName.get(name);

    if (!tool) {
      throw new Error(`Could not find tool '${name}'`);
    }
  }
}
