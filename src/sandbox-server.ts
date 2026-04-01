import type { McpUiResourceCsp } from "@modelcontextprotocol/ext-apps/app-bridge";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildSandboxHtml(): string {
  const script = readFileSync(join(__dirname, "sandbox.js"), "utf-8");
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
  const directives = [
    "default-src 'none'",
    "object-src 'none'", // always block dangerous features
  ];

  if (csp.connectDomains?.length) {
    directives.push(`connect-src ${csp.connectDomains.join(" ")}`);
  }

  if (csp.resourceDomains?.length) {
    const domains = csp.resourceDomains.join(" ");
    directives.push(
      `img-src ${domains}`,
      `script-src ${domains}`,
      `style-src ${domains}`,
      `font-src ${domains}`,
      `media-src ${domains}`
    );
  }

  // Explicit frame-src 'none' when not declared — base-uri does not inherit
  // from default-src so both must always be emitted
  if (csp.frameDomains?.length) {
    const domains = csp.frameDomains.join(" ");
    directives.push(`frame-src ${domains}`, `child-src ${domains}`);
  } else {
    directives.push("frame-src 'none'", "child-src 'none'");
  }

  directives.push(
    csp.baseUriDomains?.length
      ? `base-uri ${csp.baseUriDomains.join(" ")}`
      : "base-uri 'self'"
  );

  return directives.join("; ");
}

const port = parseInt(process.env["SANDBOX_PORT"] ?? "8081", 10);
const sandboxHtml = buildSandboxHtml();

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
