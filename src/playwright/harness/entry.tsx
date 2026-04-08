import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import { Host, type HostConnection } from "../../core/index.js";
import { Sandbox } from "../../react/index.js";

const SANDBOX_URL = `http://127.0.0.1:${window.location.port}/sandbox.html`;

interface CallToolResponse {
  result: unknown;
  input: Record<string, unknown> | undefined;
  hasUiResource: boolean;
}

interface McpHostBrowserAPI {
  connect(url: string): Promise<void>;
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<CallToolResponse>;
  teardown(): Promise<void>;
}

declare global {
  interface Window {
    __mcpHost: McpHostBrowserAPI;
  }
}

function Harness() {
  const [connection, setConnection] = useState<HostConnection | null>(null);
  const [execution, setExecution] =
    useState<HostConnection.ToolExecution | null>(null);

  const connectionRef = useRef<HostConnection | null>(null);
  const hostRef = useRef(new Host());

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    window.__mcpHost = {
      async connect(url) {
        if (connectionRef.current) {
          throw new Error(
            "Already connected. Call teardown() before connecting again.",
          );
        }

        const conn = await hostRef.current.connect({ url });
        connectionRef.current = conn;
        setConnection(conn);
      },

      async callTool(name, args) {
        const conn = connectionRef.current;
        if (!conn) {
          throw new Error("Not connected. Call connect() first.");
        }

        const exec = conn.callTool(name, args);
        setExecution(exec);

        const result = await exec.resultPromise;
        const resourceUri = getToolUiResourceUri(exec.tool);
        const hasUiResource = !!(
          resourceUri && resourceUri.startsWith("ui://")
        );

        return { result, input: exec.input, hasUiResource };
      },

      async teardown() {
        const conn = connectionRef.current;
        if (conn) {
          await conn.close();
          connectionRef.current = null;
          setConnection(null);
          setExecution(null);
        }
      },
    };
  }, []);

  return (
    <Sandbox connection={connection} execution={execution} url={SANDBOX_URL} />
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);
