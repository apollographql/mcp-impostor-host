import type { Client } from "@modelcontextprotocol/sdk/client";

export class HostConnection {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }
}
