import {
  AppBridge,
  buildAllowAttribute,
  getToolUiResourceUri,
  PostMessageTransport,
  SANDBOX_PROXY_READY_METHOD,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { useCallback } from "react";

import pkg from "#package.json";

import type { HostConnection } from "../core/index.js";
import { invariant } from "../utilities/invariant.js";
import { promiseWithResolvers } from "../utilities/promiseWithResolvers.js";

export declare namespace Sandbox {
  export interface Props {
    connection: HostConnection | null;
    execution: HostConnection.ToolExecution | null;
    url: string;
  }
}

export function Sandbox({ url, connection, execution }: Sandbox.Props) {
  const resourceUri = execution ? getToolUiResourceUri(execution.tool) : null;
  const hasUiResource = !!(connection && execution && resourceUri);

  const refCallback = useCallback(
    (iframe: HTMLIFrameElement) => {
      if (!connection || !execution || !resourceUri) return;

      invariant(!connection.closed, "The connection is already closed.");

      let initialized = false;
      let mounted = true;
      let bridge: AppBridge | undefined;

      function close() {
        mounted = false;
        if (initialized) {
          bridge?.teardownResource({}).catch(() => {});
        }

        bridge?.close();
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

          const capabilities = connection.client.getServerCapabilities();

          bridge = new AppBridge(
            connection.client,
            { name: "@apollo/mcp-impostor-host", version: pkg.version },
            {
              serverTools: capabilities?.tools,
              serverResources: capabilities?.resources,
            },
            {
              hostContext: {
                platform: "web",
              },
            },
          );

          const init = promiseWithResolvers<void>();

          bridge.oninitialized = () => {
            initialized = true;
            init.resolve();
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

  return hasUiResource ?
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
