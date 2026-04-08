import { useCallback } from "react";
import {
  AppBridge,
  buildAllowAttribute,
  PostMessageTransport,
  SANDBOX_PROXY_READY_METHOD,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type { HostConnection } from "../core/index.js";
import pkg from "#package.json";
import { invariant } from "../utilities/invariant.js";
import { promiseWithResolvers } from "../utilities/promiseWithResolvers.js";

export declare namespace Sandbox {
  export interface Props {
    url: string;
    connection: HostConnection;
    toolResult: HostConnection.CallToolResult;
  }
}

export function Sandbox({ url, connection, toolResult }: Sandbox.Props) {
  const { uiResourcePromise } = toolResult;

  const refCallback = useCallback(
    (iframe: HTMLIFrameElement) => {
      invariant(!connection.closed, "The connection is already closed.");

      if (!uiResourcePromise) return;

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

      uiResourcePromise
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
          bridge.sendToolInput({ arguments: toolResult.input });

          const result = await toolResult.resultPromise;
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
    [connection, url, uiResourcePromise],
  );

  return uiResourcePromise ? (
    <iframe
      ref={refCallback}
      sandbox="allow-scripts allow-same-origin allow-forms"
    />
  ) : null;
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

    function handleMessage(event: MessageEvent<any>) {
      if (
        event.source === iframe.contentWindow &&
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
