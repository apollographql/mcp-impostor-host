import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_CSP } from "../utilities/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function normalizeDomains(domains: string[] | undefined) {
  if (!domains || domains.length === 0) {
    return;
  }

  return domains.filter(Boolean).join(" ");
}

function buildCspHeader(csp: McpUiResourceCsp): string {
  const resourceDomains = normalizeDomains(csp.resourceDomains);
  const connectDomains = normalizeDomains(csp.connectDomains);
  const frameDomains = normalizeDomains(csp.frameDomains);
  const baseUriDomains = normalizeDomains(csp.baseUriDomains);

  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${resourceDomains || ""}`,
    `style-src 'self' 'unsafe-inline' ${resourceDomains || ""}`,
    `img-src 'self' data: ${resourceDomains || ""}`,
    `font-src 'self' ${resourceDomains || ""}`,
    `media-src 'self' data: ${resourceDomains || ""}`,
    connectDomains
      ? `connect-src 'self' ${connectDomains}`
      : "connect-src 'none'",
    `frame-src ${frameDomains || "'none'"}`,
    "object-src 'none'",
    `base-uri ${baseUriDomains || "'self'"}`,
  ]
    .map((str) => str.trim())
    .join("; ");
}

const port = parseInt(process.env["SANDBOX_PORT"] ?? "8080", 10);
const sandboxHtml = readFileSync(join(__dirname, "sandbox.html"), "utf-8");

// This server serves two roles on the same port:
//
// 1. Harness page at http://localhost:{port}/
//    Loads the host bundle so window.__mcpHost is available for
//    manual testing (browser console) and Playwright automation.
//
// 2. Sandbox proxy at http://127.0.0.1:{port}/sandbox.html
//    Serves the sandbox iframe with CSP headers. Uses a different
//    hostname (127.0.0.1 vs localhost) on the same port to get
//    cross-origin isolation, which the MCP Apps spec requires.
const server = createServer((req, res) => {
  if (req.url?.startsWith("/sandbox.html")) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const cspParam = url.searchParams.get("csp");

    let cspHeader = DEFAULT_CSP;
    if (cspParam) {
      try {
        const csp = JSON.parse(cspParam) as McpUiResourceCsp;
        cspHeader = buildCspHeader(csp);
      } catch {
        // ignore malformed CSP param
      }
    }

    res
      .writeHead(200, {
        "Content-Type": "text/html",
        "Content-Security-Policy": cspHeader,
      })
      .end(sandboxHtml);
  } else {
    res.writeHead(404).end();
  }
});

server.listen(port, () => {
  console.log(
    `[@apollo/mcp-impostor-host] Server running on http://localhost:${port}`,
  );
});
