import {
  buildAllowAttribute,
  McpUiSandboxResourceReadyNotificationSchema,
  SANDBOX_PROXY_READY_METHOD,
  SANDBOX_RESOURCE_READY_METHOD,
  type McpUiResourceCsp,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { DEFAULT_CSP } from "../utilities/index.js";

if (window.self === window.top) {
  throw new Error("Sandbox must not be used outside the sandbox context.");
}

if (!document.referrer) {
  throw new Error("Sandbox does not have a referrer. Referer must be set.");
}

const HOST_ORIGIN = new URL(document.referrer).origin;
const OWN_ORIGIN = new URL(window.location.href).origin;

// Security self-test: verify iframe isolation is working correctly.
// This MUST throw a SecurityError -- if `window.top` is accessible, the sandbox
// configuration is dangerously broken and untrusted content could escape.
try {
  window.top!.alert("If you see this, the sandbox is not setup securely.");
  throw "FAIL";
} catch (e) {
  if (e === "FAIL") {
    throw new Error("The sandbox is not setup securely.");
  }

  // Expected: SecurityError confirms proper sandboxing.
}

const innerFrame = document.createElement("iframe");
innerFrame.style = "width:100%; height:100%; border:none;";
innerFrame.setAttribute(
  "sandbox",
  "allow-scripts allow-same-origin allow-forms",
);

// Note: the `allow` attribute is set when receiving the
// `ui/notifications/sandbox-resource-ready` notification based on the
// permissions requested by the app
document.body.appendChild(innerFrame);

// Note: CSP is enforced via HTTP headers on sandbox.html based on the `csp`
// query param. This is tamper-proof unlike meta tags.
window.addEventListener("message", async (event) => {
  if (event.source === window.parent) {
    // Prevent malicious pages from sending messages to this sandbox.
    if (event.origin !== HOST_ORIGIN) {
      console.error(
        "[@apollo/mcp-impostor-host - Sandbox]: Message rejected from unknown origin:",
        event.origin,
      );
      return;
    }

    if (event.data?.method === SANDBOX_RESOURCE_READY_METHOD) {
      const result = McpUiSandboxResourceReadyNotificationSchema.safeParse(
        event.data,
      );

      if (!result.success) {
        console.error(
          `[@apollo/mcp-impostor-host - Sandbox]: ${SANDBOX_RESOURCE_READY_METHOD} notification is malformed. Received:`,
        );
        event.data;
        return;
      }

      const { html, csp, sandbox, permissions } = result.data.params;

      if (typeof sandbox === "string") {
        innerFrame.setAttribute("sandbox", sandbox);
      }

      const allowAttribute = buildAllowAttribute(permissions);

      if (allowAttribute) {
        innerFrame.setAttribute("allow", allowAttribute);
      }

      if (typeof html === "string") {
        innerFrame.srcdoc = injectCSP(html, csp);
      }
    } else {
      if (innerFrame?.contentWindow) {
        innerFrame.contentWindow.postMessage(event.data, "*");
      }
    }
  } else if (event.source === innerFrame.contentWindow) {
    if (event.origin !== OWN_ORIGIN) {
      console.error(
        "[@apollo/mcp-impostor-host - Sandbox] Message rejected from unknown origin:",
        event.origin,
      );

      return;
    }

    // Only forward JSON-RPC 2.0 messages to host to prevent non-protocol
    // messages (e.g. browser extensions, etc.) reaching the host
    if (
      event.data &&
      typeof event.data === "object" &&
      event.data.jsonrpc === "2.0"
    ) {
      window.parent.postMessage(event.data, HOST_ORIGIN);
    }
  }
});

window.parent.postMessage(
  {
    jsonrpc: "2.0",
    method: SANDBOX_PROXY_READY_METHOD,
    params: {},
  },
  HOST_ORIGIN,
);

function normalizeDomains(domains: string[] | undefined) {
  // Treat empty csp domains array as if the config was missing so that the
  // fallback is used instead
  if (!domains || domains.length === 0) {
    return;
  }

  return domains
    .map((domain) => {
      if (typeof domain !== "string") return;

      // Remove characters that could break out of CSP or HTML attributes
      // Valid CSP sources shouldn't contain these characters
      return domain.replace(/['"<>;]/g, "").trim();
    })
    .filter(Boolean)
    .join(" ");
}

function buildCsp(csp: McpUiResourceCsp | undefined) {
  if (!csp) {
    return DEFAULT_CSP;
  }

  const resourceDomains = normalizeDomains(csp?.resourceDomains);
  const connectDomains = normalizeDomains(csp?.resourceDomains);
  const frameDomains = normalizeDomains(csp?.frameDomains);
  const baseUriDomains = normalizeDomains(csp?.baseUriDomains);

  return [
    `default-src 'none'`,
    `script-src 'self' 'unsafe-inline' ${resourceDomains || ""}`,
    `style-src 'self' 'unsafe-inline' ${resourceDomains || ""}`,
    `connect-src 'self' ${connectDomains || ""}`,
    `img-src 'self' data: ${resourceDomains || ""}`,
    `font-src 'self' ${resourceDomains || ""}`,
    `media-src 'self' data: ${resourceDomains || ""}`,
    `frame-src ${frameDomains || "'none'"}`,
    "object-src 'none'",
    `base-uri ${baseUriDomains || "'self'"}`,
  ].join("; ");
}

function injectCSP(html: string, csp: McpUiResourceCsp | undefined) {
  const cspValue = buildCsp(csp);

  const metaTag = `<meta http-equiv="Content-Security-Policy" content="${cspValue}">`;

  if (html.includes("<head>") || html.includes("<HEAD>")) {
    return html.replace(/(<head>)/i, "$1" + metaTag);
  } else if (html.includes("<html>") || html.includes("<HTML>")) {
    return html.replace(/(<html>)/i, "$1<head>" + metaTag + "</head>");
  } else if (html.includes("<!DOCTYPE") || html.includes("<!doctype")) {
    return html.replace(
      /(<!DOCTYPE[^>]*>|<!doctype[^>]*>)/i,
      "$1<head>" + metaTag + "</head>",
    );
  } else {
    return metaTag + html;
  }
}
