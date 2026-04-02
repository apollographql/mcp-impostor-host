import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildSandboxHtml(): string {
  const script = readFileSync(join(__dirname, "sandbox.bundle.js"), "utf-8");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>${script}</script></body></html>`;
}

// Applied when ui.csp is omitted entirely, per spec §"Restrictive Default"
const DEFAULT_CSP =
  "default-src 'none'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "media-src 'self' data:; " +
  "connect-src 'none'; " +
  "object-src 'none'; " +
  "frame-src 'none'; " +
  "child-src 'none'; " +
  "base-uri 'self'";

function buildCspHeader(csp: McpUiResourceCsp): string {
  const resourceDomains = csp.resourceDomains?.join(" ") ?? "";
  const connectDomains = csp.connectDomains?.join(" ") ?? "";
  const frameDomains = csp.frameDomains?.join(" ") ?? "";
  const baseUriDomains = csp.baseUriDomains?.join(" ") ?? "";

  // Baseline directives always present per spec.
  // resourceDomains/connectDomains are appended when declared.
  const directives = [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline'${resourceDomains ? ` ${resourceDomains}` : ""}`,
    `style-src 'self' 'unsafe-inline'${resourceDomains ? ` ${resourceDomains}` : ""}`,
    `img-src 'self' data:${resourceDomains ? ` ${resourceDomains}` : ""}`,
    `font-src 'self'${resourceDomains ? ` ${resourceDomains}` : ""}`,
    `media-src 'self' data:${resourceDomains ? ` ${resourceDomains}` : ""}`,
    connectDomains ?
      `connect-src 'self' ${connectDomains}`
    : "connect-src 'none'",
    frameDomains ? `frame-src ${frameDomains}` : "frame-src 'none'",
    frameDomains ? `child-src ${frameDomains}` : "child-src 'none'",
    "object-src 'none'",
    baseUriDomains ? `base-uri ${baseUriDomains}` : "base-uri 'self'",
  ];

  return directives.join("; ");
}

const port = parseInt(process.env["SANDBOX_PORT"] ?? "8081", 10);
const sandboxHtml = buildSandboxHtml();

const server = createServer((req, res) => {
  // Allow cross-origin requests from localhost (needed for Private Network Access)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/" || req.url === "") {
    // Harness page — minimal HTML for the host to run in.
    // Served on localhost so the browser has a real loopback origin
    // (required for Chrome's Private Network Access).
    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    });
    res.end("<!DOCTYPE html><html><head></head><body></body></html>");
  } else if (req.url?.startsWith("/sandbox.html")) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const cspParam = url.searchParams.get("csp");

    let cspHeader = DEFAULT_CSP;
    if (cspParam) {
      try {
        const csp = JSON.parse(cspParam) as McpUiResourceCsp;
        cspHeader = buildCspHeader(csp);
      } catch {
        // ignore malformed CSP param, fall back to default
      }
    }

    res.writeHead(200, {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
      "Content-Security-Policy": cspHeader,
    });
    res.end(sandboxHtml);
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(port, () => {
  console.log(
    `[mcp-impostor-host] Sandbox server running on http://localhost:${port}`
  );
});
