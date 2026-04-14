import { StreamableHTTPTransport } from "@hono/mcp";
import { serve } from "@hono/node-server";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";

const port = parseInt(process.env["MOCK_SERVER_PORT"] ?? "3456", 10);

// Minimal App initialization handshake — sends ui/initialize, waits for
// the response, then sends ui/notifications/initialized. This replaces
// the full App SDK for these simple test views.
const APP_INIT_SCRIPT = `
window.addEventListener("message", function(event) {
  const data = event.data;
  if (!data || !data.jsonrpc) return;
  if (data.id === 1 && data.result) {
    window.parent.postMessage({
      jsonrpc: "2.0",
      method: "ui/notifications/initialized",
      params: {}
    }, "*");
  }
  if (data.method === "ui/resource-teardown") {
    window.parent.postMessage({
      jsonrpc: "2.0",
      id: data.id,
      result: {}
    }, "*");
  }
});
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "ui/initialize",
  params: {
    appInfo: { name: "test-app", version: "0.0.1" },
    appCapabilities: {},
    protocolVersion: "2026-01-26"
  }
}, "*");
`;

const server = new McpServer({ name: "mock-server", version: "0.0.1" });

registerAppTool(
  server,
  "hello",
  {
    description: "A simple hello world tool",
    _meta: { ui: { resourceUri: "ui://mock/hello.html" } },
  },
  async () => ({
    content: [{ type: "text" as const, text: "Hello from mock" }],
  }),
);

registerAppResource(
  server,
  "Hello View",
  "ui://mock/hello.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://mock/hello.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: `<!DOCTYPE html>
<html>
  <body>
    <h1>Hello world</h1>
    <script>${APP_INIT_SCRIPT}</script>
  </body>
</html>`,
      },
    ],
  }),
);

registerAppTool(
  server,
  "greet",
  {
    description: "Greet someone by name",
    inputSchema: { name: z.string() },
    _meta: { ui: { resourceUri: "ui://mock/greet.html" } },
  },
  async ({ name }: { name: string }) => ({
    content: [{ type: "text" as const, text: `Greeted ${name}` }],
  }),
);

registerAppResource(
  server,
  "Greet View",
  "ui://mock/greet.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://mock/greet.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: `<!DOCTYPE html>
<html>
  <body>
    <h1 id="greeting">Loading...</h1>
    <script>
      ${APP_INIT_SCRIPT}
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (data && data.method === "ui/notifications/tool-input") {
          const name = (data.params && data.params.arguments && data.params.arguments.name) || "stranger";
          document.getElementById("greeting").textContent = "Hello, " + name + "!";
        }
      });
    </script>
  </body>
</html>`,
      },
    ],
  }),
);

registerAppTool(
  server,
  "host-context",
  {
    description: "Displays current host context values",
    _meta: { ui: { resourceUri: "ui://mock/host-context.html" } },
  },
  async () => ({
    content: [{ type: "text" as const, text: "Host context tool" }],
  }),
);

registerAppResource(
  server,
  "Host Context View",
  "ui://mock/host-context.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://mock/host-context.html",
        mimeType: RESOURCE_MIME_TYPE,
        text: `<!DOCTYPE html>
<html>
  <body>
    <div id="theme">Loading...</div>
    <div id="locale">Loading...</div>
    <div id="timeZone">Loading...</div>
    <script>
      ${APP_INIT_SCRIPT}
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (!data || !data.jsonrpc) return;

        // Read host context from init response
        if (data.id === 1 && data.result && data.result.hostContext) {
          updateContext(data.result.hostContext);
        }

        // Listen for host context changes
        if (data.method === "ui/notifications/host-context-changed") {
          updateContext(data.params);
        }
      });

      function updateContext(ctx) {
        if (ctx.theme !== undefined) {
          document.getElementById("theme").textContent = ctx.theme;
        }
        if (ctx.locale !== undefined) {
          document.getElementById("locale").textContent = ctx.locale;
        }
        if (ctx.timeZone !== undefined) {
          document.getElementById("timeZone").textContent = ctx.timeZone;
        }
      }
    </script>
  </body>
</html>`,
      },
    ],
  }),
);

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);

const transport = new StreamableHTTPTransport();

app.get("/", (c) => c.text("ok"));

app.all("/mcp", async (c) => {
  if (!server.isConnected()) {
    await server.connect(transport);
  }

  return transport.handleRequest(c);
});

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `[mock-server] MCP server running on http://localhost:${port}/mcp`,
  );
});
