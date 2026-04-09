import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Hono } from "hono";

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
    connectDomains ?
      `connect-src 'self' ${connectDomains}`
    : "connect-src 'none'",
    `frame-src ${frameDomains || "'none'"}`,
    "object-src 'none'",
    `base-uri ${baseUriDomains || "'self'"}`,
  ]
    .map((str) => str.trim())
    .join("; ");
}

const args = process.argv.slice(2);
const enablePlaywright = args.includes("--playwright");

const port = parseInt(process.env["SANDBOX_PORT"] ?? "8080", 10);
const sandboxHtml = readFileSync(join(__dirname, "sandbox.html"), "utf-8");

// This server serves two roles on the same port, using different
// hostnames for cross-origin isolation (required by MCP Apps spec):
//
// 1. Sandbox proxy at http://127.0.0.1:{port}/sandbox.html
//    Serves the sandbox iframe with CSP headers.
//
// 2. (opt-in via --playwright) Harness page at http://localhost:{port}/
//    Loads the test harness React app with window.__mcpHost for
//    Playwright automation.
const app = new Hono();

app.get("/sandbox.html", (c) => {
  const cspParam = c.req.query("csp");

  let cspHeader = DEFAULT_CSP;
  if (cspParam) {
    try {
      const csp = JSON.parse(cspParam) as McpUiResourceCsp;
      cspHeader = buildCspHeader(csp);
    } catch {
      // ignore malformed CSP param
    }
  }

  c.header("Content-Security-Policy", cspHeader);
  return c.html(sandboxHtml);
});

if (enablePlaywright) {
  const harnessHtml = readFileSync(
    join(__dirname, "..", "playwright", "harness", "harness.html"),
    "utf-8",
  );

  app.get("/", (c) => c.html(harnessHtml));
}

serve({ fetch: app.fetch, port }, () => {
  const lines = [
    `[@apollo/mcp-impostor-host] Sandbox server running on http://127.0.0.1:${port}`,
  ];

  if (enablePlaywright) {
    lines.push(
      `[@apollo/mcp-impostor-host] Playwright harness running on http://localhost:${port}`,
    );
  }

  console.log(lines.join("\n"));
});
