import { Client } from "@modelcontextprotocol/sdk/client";
import { UI_EXTENSION_CAPABILITIES } from "@mcp-ui/client";
import pkg from "#package.json" with { type: "json " };
import { HostConnection } from "./HostConnection";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import type { Resource, Tool } from "@modelcontextprotocol/sdk/types";

export declare namespace Host {
  export interface Config {
    sandbox: HostConnection.SandboxConfig;
  }

  export interface ConnectOptions {
    url: string;
  }
}

export class Host {
  private config: Host.Config;
  private client: Client;

  constructor(config: Host.Config) {
    this.config = config;
    this.client = new Client(
      {
        name: "@apollo/mcp-impostor-host",
        version: pkg.version,
      },
      { capabilities: { extensions: UI_EXTENSION_CAPABILITIES } },
    );
  }

  async connect(options: Host.ConnectOptions) {
    const transport = new StreamableHTTPClientTransport(new URL(options.url));
    await this.client.connect(transport);

    const [tools, resources] = await Promise.all([
      this.#fetchAllTools(),
      this.#fetchAllResources(),
    ]);

    return new HostConnection(this.client, {
      tools,
      resources,
      sandbox: this.config.sandbox,
    });
  }

  async #fetchAllTools() {
    const fetchTools = async (cursor?: string): Promise<Tool[]> => {
      const { tools, nextCursor } = await this.client.listTools({ cursor });

      return nextCursor ? tools.concat(await fetchTools(nextCursor)) : tools;
    };

    return fetchTools();
  }

  async #fetchAllResources() {
    const fetchResources = async (cursor?: string): Promise<Resource[]> => {
      const { resources, nextCursor } = await this.client.listResources({
        cursor,
      });

      return nextCursor
        ? resources.concat(await fetchResources(nextCursor))
        : resources;
    };

    return fetchResources();
  }
}
