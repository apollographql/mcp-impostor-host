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

function buildCspHeader(csp: McpUiResourceCsp): string {
  const directives = ["default-src 'none'"];

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

  if (csp.frameDomains?.length) {
    const domains = csp.frameDomains.join(" ");
    directives.push(`frame-src ${domains}`, `child-src ${domains}`);
  }

  if (csp.baseUriDomains?.length) {
    directives.push(`base-uri ${csp.baseUriDomains.join(" ")}`);
  }

  return directives.join("; ");
}

const port = parseInt(process.env["SANDBOX_PORT"] ?? "8081", 10);
const sandboxHtml = buildSandboxHtml();

const server = createServer((req, res) => {
  if (req.url?.startsWith("/sandbox.html")) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const cspParam = url.searchParams.get("csp");

    const headers: Record<string, string> = {
      "Content-Type": "text/html",
      "Cache-Control": "no-store",
    };

    if (cspParam) {
      try {
        const csp = JSON.parse(cspParam) as McpUiResourceCsp;
        headers["Content-Security-Policy"] = buildCspHeader(csp);
      } catch {
        // ignore malformed CSP param
      }
    }

    res.writeHead(200, headers);
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
