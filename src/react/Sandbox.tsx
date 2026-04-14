import {
  AppBridge,
  buildAllowAttribute,
  getToolUiResourceUri,
  type McpUiHostContext,
  type McpUiMessageRequest,
  type McpUiOpenLinkRequest,
  PostMessageTransport,
  SANDBOX_PROXY_READY_METHOD,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { Tool } from "@modelcontextprotocol/sdk/types";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import pkg from "#package.json";

import type { HostConnection } from "../core/index.js";
import type { SandboxHostContext } from "./hooks/useHostContext.js";
import { invariant } from "../utilities/invariant.js";
import { promiseWithResolvers } from "../utilities/promiseWithResolvers.js";

export declare namespace Sandbox {
  export interface Props {
    connection: HostConnection;
    execution: HostConnection.ToolExecution;
    hostContext?: SandboxHostContext;
    url: string;
    onMessage?: (params: McpUiMessageRequest["params"]) => void;
    onOpenLink?: (params: McpUiOpenLinkRequest["params"]) => void;
  }
}

function mergeHostContext(
  hostContext: SandboxHostContext | undefined,
  tool: Tool,
): McpUiHostContext {
  return {
    ...hostContext,
    platform: "web",
    userAgent: pkg.name,
    toolInfo: {
      tool,
    },
  };
}

export function Sandbox({
  url,
  connection,
  execution,
  hostContext,
  onMessage,
  onOpenLink,
}: Sandbox.Props) {
  const resourceUri = getToolUiResourceUri(execution.tool);
  const onMessageRef = useRef(onMessage);
  const onOpenLinkRef = useRef(onOpenLink);
  const bridgeRef = useRef<AppBridge | null>(null);

  // Keep track of hostContext in a ref so that we avoid tearing down/recreating
  // the ref callback anytime we get a new hostContext object
  const hostContextRef = useRef(hostContext);

  useLayoutEffect(() => {
    onMessageRef.current = onMessage;
    onOpenLinkRef.current = onOpenLink;
    hostContextRef.current = hostContext;
  });

  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.setHostContext(
        mergeHostContext(hostContext, execution.tool),
      );
    }
  }, [hostContext, execution.tool]);

  const refCallback = useCallback(
    (iframe: HTMLIFrameElement) => {
      invariant(!connection.closed, "The connection is already closed.");
      invariant(
        resourceUri,
        "`resourceUri` not set. This is a bug in @apollo/mcp-impostor-host. Please open an issue",
      );

      let initialized = false;
      let mounted = true;

      function close() {
        mounted = false;
        if (initialized) {
          bridgeRef.current?.teardownResource({}).catch(() => {});
        }

        bridgeRef.current?.close();
        bridgeRef.current = null;
      }

      connection.addEventListener("close", close);

      connection
        .getUiResource(resourceUri)
        .then(async (uiResource) => {
          if (!mounted) {
            return;
          }

          const allowAttribute = buildAllowAttribute(uiResource.permissions);

          if (allowAttribute) {
            iframe.setAttribute("allow", allowAttribute);
          }

          iframe.src = getSandboxSrc(url, uiResource);

          await waitForSandboxReady(iframe);

          const bridge = new AppBridge(
            connection.client,
            { name: pkg.name, version: pkg.version },
            {
              serverTools: {},
              serverResources: {},
              message: {},
              openLinks: {},
            },
            {
              hostContext: mergeHostContext(
                hostContextRef.current,
                execution.tool,
              ),
            },
          );

          bridgeRef.current = bridge;

          const init = promiseWithResolvers<void>();

          bridge.oninitialized = () => {
            initialized = true;
            init.resolve();
          };

          bridge.onmessage = async (params) => {
            onMessageRef.current?.(params);
            return {};
          };

          bridge.onopenlink = async (params) => {
            onOpenLinkRef.current?.(params);
            return {};
          };

          await bridge.connect(
            new PostMessageTransport(
              iframe.contentWindow!,
              iframe.contentWindow!,
            ),
          );

          bridge.sendSandboxResourceReady(uiResource);

          await init.promise;
          bridge.sendToolInput({ arguments: execution.input });

          const result = await execution.resultPromise;
          bridge.sendToolResult(result);
        })
        .catch((error) => {
          if (error instanceof Error) {
            connection.logger.error(error.message, error.cause);
          }
        });

      return () => {
        mounted = false;
        close();
        connection.removeEventListener("close", close);
      };
    },
    [connection, execution, resourceUri, url],
  );

  return resourceUri ?
      <iframe
        ref={refCallback}
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{
          border: "none",
          width: "100dvw",
          height: "100dvh",
          backgroundColor: "transparent",
        }}
      />
    : null;
}

function getSandboxSrc(baseUrl: string, uiResource: HostConnection.UiResource) {
  const src = new URL(baseUrl);

  if (uiResource.csp && Object.keys(uiResource.csp).length > 0) {
    src.searchParams.set("csp", JSON.stringify(uiResource.csp));
  }

  return src.href;
}

function waitForSandboxReady(iframe: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    function cleanup() {
      window.removeEventListener("message", handleMessage);
      iframe.removeEventListener("error", handleError);
    }

    function handleError(event: ErrorEvent) {
      reject(new Error("Could not load iframe", { cause: event.error }));
      cleanup();
    }

    function handleMessage(event: MessageEvent<unknown>) {
      if (
        event.source === iframe.contentWindow &&
        event.data &&
        typeof event.data === "object" &&
        "method" in event.data &&
        event.data?.method === SANDBOX_PROXY_READY_METHOD
      ) {
        resolve();
        cleanup();
      }
    }

    window.addEventListener("message", handleMessage);
    iframe.addEventListener("error", handleError);
  });
}
