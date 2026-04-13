import type {
  McpUiMessageRequest,
  McpUiOpenLinkRequest,
} from "@modelcontextprotocol/ext-apps";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { Host, type HostConnection } from "../../core/index.js";
import { Sandbox, useHostContext } from "../../react/index.js";
import { invariant } from "../../utilities/index.js";
import type { McpHost } from "../types.js";

const HOSTNAME =
  window.location.hostname === "localhost" ? "127.0.0.1" : "localhost";
const SANDBOX_URL = `http://${HOSTNAME}:${window.location.port}/sandbox.html`;

declare global {
  interface Window {
    __mcpHost: McpHost;
    __playwrightPushMessage: (params: McpUiMessageRequest["params"]) => void;
    __playwrightSendOpenLinkRequest: (
      params: McpUiOpenLinkRequest["params"],
    ) => void;
  }
}

function Harness() {
  const [hostContext, setHostContext] = useHostContext();
  const [host] = useState(() => new Host());
  const [connection, setConnection] = useState<HostConnection | null>(null);
  const [execution, setExecution] =
    useState<HostConnection.ToolExecution | null>(null);

  useEffect(() => {
    window.__mcpHost = {
      async connect(url) {
        setConnection(await host.connect({ url }));
      },

      setHostContext: setHostContext,

      async callTool(name, args) {
        invariant(
          connection,
          "Host not connected. Call `connect()` before calling executing a tool call.",
        );

        const execution = connection.callTool(name, args);
        setExecution(execution);

        return {
          result: await execution.resultPromise,
          input: execution.input,
        };
      },

      async teardown() {
        if (connection) {
          await connection.close();
          setConnection(null);
          setExecution(null);
        }
      },
    };
  }, [host, connection, setHostContext]);

  return connection ?
      <Sandbox
        connection={connection}
        execution={execution}
        hostContext={hostContext}
        url={SANDBOX_URL}
        onMessage={(params) => window.__playwrightPushMessage(params)}
        onOpenLink={(params) => window.__playwrightSendOpenLinkRequest(params)}
      />
    : null;
}

createRoot(document.getElementById("root")!).render(<Harness />);
