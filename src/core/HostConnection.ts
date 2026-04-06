import type { Client } from "@modelcontextprotocol/sdk/client";
import type { Tool } from "@modelcontextprotocol/sdk/types";

export class HostConnection {
  private client: Client;
  private toolInfoByName = new Map<string, Tool>();

  constructor(client: Client) {
    this.client = client;
  }

  private nextToolCursor: string | undefined;

  private async findTool(name: string): Promise<Tool | undefined> {
    let tool: Tool | undefined = this.toolInfoByName.get(name);

    if (tool) {
      return tool;
    }

    const result = await this.client.listTools({ cursor: this.nextToolCursor });
    this.nextToolCursor = result.nextCursor;

    for (const toolDef of result.tools) {
      this.toolInfoByName.set(toolDef.name, toolDef);

      if (toolDef.name === name) {
        tool = toolDef;
      }
    }

    if (!tool && this.nextToolCursor) {
      tool = await this.findTool(name);
    }

    return tool;
  }
}
