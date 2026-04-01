import type {
  McpUiSandboxProxyReadyNotification,
  McpUiSandboxResourceReadyNotification,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { buildAllowAttribute } from "@modelcontextprotocol/ext-apps/app-bridge";

// Allow any localhost/127.0.0.1 origin — test environments only
const ALLOWED_REFERRER_PATTERN =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

if (window.self === window.top) {
  throw new Error("sandbox.ts must only be loaded inside an iframe.");
}

if (!document.referrer) {
  throw new Error("No referrer — cannot validate embedding origin.");
}

if (!ALLOWED_REFERRER_PATTERN.test(document.referrer)) {
  throw new Error(
    `Embedding origin not allowed: "${document.referrer}". Only localhost is permitted.`
  );
}

const EXPECTED_HOST_ORIGIN = new URL(document.referrer).origin;
const OWN_ORIGIN = new URL(window.location.href).origin;

// Verify the sandbox is truly cross-origin from its parent. If this throws
// a security error, the try/catch swallows it (expected). If it succeeds,
// the sandbox is not properly isolated.
try {
  window.top!.alert("If you see this, the sandbox is not set up securely.");
  throw "FAIL";
} catch (e) {
  if (e === "FAIL") {
    throw new Error("Sandbox is not properly cross-origin isolated.");
  }
}

const inner = document.createElement("iframe");
inner.style.cssText = "width:100%;height:100%;border:none;";
inner.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
document.body.appendChild(inner);

const RESOURCE_READY: McpUiSandboxResourceReadyNotification["method"] =
  "ui/notifications/sandbox-resource-ready";
const PROXY_READY: McpUiSandboxProxyReadyNotification["method"] =
  "ui/notifications/sandbox-proxy-ready";

const SANDBOX_METHOD_PREFIX = "ui/notifications/sandbox-";

window.addEventListener("message", (event) => {
  if (event.source === window.parent) {
    if (event.origin !== EXPECTED_HOST_ORIGIN) {
      console.error(
        "[Sandbox] Rejected message from unexpected origin:",
        event.origin
      );
      return;
    }

    // Per spec: sandbox MUST NOT forward methods starting with "ui/notifications/sandbox-"
    if (event.data?.method?.startsWith(SANDBOX_METHOD_PREFIX)) {
      if (event.data.method === RESOURCE_READY) {
        const { html, sandbox, permissions } = event.data.params;

        if (typeof sandbox === "string") {
          inner.setAttribute("sandbox", sandbox);
        }

        const allow = buildAllowAttribute(permissions);
        if (allow) {
          inner.setAttribute("allow", allow);
        }

        if (typeof html === "string") {
          const doc = inner.contentDocument ?? inner.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
          } else {
            inner.srcdoc = html;
          }
        }
      }
      // All other sandbox-prefixed methods are silently ignored
    } else {
      inner.contentWindow?.postMessage(event.data, "*");
    }
  } else if (event.source === inner.contentWindow) {
    if (event.origin !== OWN_ORIGIN) {
      console.error(
        "[Sandbox] Rejected message from inner iframe with unexpected origin:",
        event.origin
      );
      return;
    }
    window.parent.postMessage(event.data, EXPECTED_HOST_ORIGIN);
  }
});

window.parent.postMessage(
  { jsonrpc: "2.0", method: PROXY_READY, params: {} },
  EXPECTED_HOST_ORIGIN
);
