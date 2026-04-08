import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { Host, type HostConnection } from "../../core/index.js";
import { Sandbox } from "../../react/index.js";
import { invariant } from "../../utilities/index.js";
import type { McpHost } from "../types.js";

const HOSTNAME =
  window.location.hostname === "localhost" ? "127.0.0.1" : "localhost";
const SANDBOX_URL = `http://${HOSTNAME}:${window.location.port}/sandbox.html`;

declare global {
  interface Window {
    __mcpHost: McpHost;
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
        const conn = await hostRef.current.connect({ url });
        connectionRef.current = conn;
        setConnection(conn);
      },

      async callTool(name, args) {
        const connection = connectionRef.current;

        invariant(
          connection,
          "Host not connected. Call `connect()` before calling executing a tool call.",
        );

        const exec = connection.callTool(name, args);
        setExecution(exec);

        const result = await exec.resultPromise;

        return { result, input: exec.input };
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
