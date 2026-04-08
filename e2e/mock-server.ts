import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const port = parseInt(process.env["MOCK_SERVER_PORT"] ?? "3456", 10);

// Minimal App initialization handshake — sends ui/initialize, waits for
// the response, then sends ui/notifications/initialized. This replaces
// the full App SDK for these simple test views.
const APP_INIT_SCRIPT = `
(function() {
  window.addEventListener("message", function(event) {
    var data = event.data;
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
})();
`;

function createMockServer(): McpServer {
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
      window.addEventListener("message", function(event) {
        var data = event.data;
        if (data && data.method === "ui/notifications/tool-input") {
          var name = (data.params && data.params.arguments && data.params.arguments.name) || "stranger";
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

  return server;
}

const transports: Record<string, StreamableHTTPServerTransport> = {};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, mcp-session-id, mcp-protocol-version, Last-Event-ID",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const httpServer = createServer(async (req, res) => {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url?.startsWith("/mcp")) {
    res.writeHead(404);
    res.end();
    return;
  }

  try {
    if (req.method === "POST") {
      const body = await readBody(req);
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && transports[sessionId]) {
        await transports[sessionId]!.handleRequest(req, res, body);
      } else {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports[id] = transport;
          },
        });

        const server = createMockServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
      }
    } else if (req.method === "GET") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports[sessionId]) {
        await transports[sessionId]!.handleRequest(req, res);
      } else {
        res.writeHead(400);
        res.end("Missing or invalid session ID");
      }
    } else if (req.method === "DELETE") {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      if (sessionId && transports[sessionId]) {
        await transports[sessionId]!.handleRequest(req, res);
        delete transports[sessionId];
      } else {
        res.writeHead(400);
        res.end("Missing or invalid session ID");
      }
    } else {
      res.writeHead(405);
      res.end();
    }
  } catch (err) {
    console.error("[mock-server] Error:", err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Internal server error");
    }
  }
});

function readBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString()));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", reject);
  });
}

httpServer.listen(port, () => {
  console.log(
    `[mock-server] MCP server running on http://localhost:${port}/mcp`,
  );
});
