import { Client } from "@modelcontextprotocol/sdk/client";
import { UI_EXTENSION_CAPABILITIES } from "@mcp-ui/client";
import pkg from "#package.json" with { type: "json " };
import { HostConnection } from "./HostConnection";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

interface SandboxConfig {
  url: string;
}

interface HostConfig {
  sandbox: SandboxConfig;
}

interface ConnectOptions {
  url: string;
}

export class Host {
  private config: HostConfig;
  private client: Client;

  constructor(config: HostConfig) {
    this.config = config;
    this.client = new Client(
      {
        name: "@apollo/mcp-impostor-host",
        version: pkg.version,
      },
      { capabilities: { extensions: UI_EXTENSION_CAPABILITIES } },
    );
  }

  async connect(options: ConnectOptions) {
    const transport = new StreamableHTTPClientTransport(new URL(options.url));
    await this.client.connect(transport);

    return new HostConnection(this.client);
  }
}
