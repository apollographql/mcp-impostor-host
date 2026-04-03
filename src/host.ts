import {
  AppBridge,
  PostMessageTransport,
  buildAllowAttribute,
  getToolUiResourceUri,
  RESOURCE_MIME_TYPE,
  type McpUiResourceCsp,
  type McpUiResourcePermissions,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolResult {
  result: CallToolResult;
  view: HTMLIFrameElement | null;
}

export interface RecordedMessage {
  role: string;
  content: unknown;
}

export interface RecordedModelContextUpdate {
  content?: unknown;
  structuredContent?: Record<string, unknown>;
}

export interface RecordedLogMessage {
  level: string;
  logger?: string;
  data: unknown;
}

export interface HostConnection {
  executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult>;
  /** All URLs passed to `ui/open-link` since the connection was established. */
  readonly openedLinks: readonly string[];
  /** All messages sent by the view via `ui/message`. */
  readonly messages: readonly RecordedMessage[];
  /** All model context updates sent by the view via `ui/update-model-context`. */
  readonly modelContextUpdates: readonly RecordedModelContextUpdate[];
  /** All log messages sent by the view via `notifications/message`. */
  readonly logMessages: readonly RecordedLogMessage[];
  /** Optional handler called when the view requests a link to be opened. */
  onOpenLink: ((url: string) => void) | null;
  teardown(): Promise<void>;
}

export interface Host {
  connect(): Promise<HostConnection>;
}

export interface HostConfig {
  uri: string;
  sandboxUrl?: string;
  /**
   * Container dimensions passed to the view in host context.
   * Defaults to `{ maxHeight: 6000 }` if not specified.
   */
  containerDimensions?: ({ height: number } | { maxHeight?: number }) &
    ({ width: number } | { maxWidth?: number });
}

export const TEARDOWN_REASON = "mcp-impostor-host: test teardown";

const HOST_INFO = { name: "mcp-impostor-host", version: "0.0.1" } as const;

// Extensions field is pending SEP-1724 and not yet in the SDK's ClientCapabilities type
const CLIENT_CAPABILITIES = {
  extensions: {
    "io.modelcontextprotocol/ui": {
      mimeTypes: [RESOURCE_MIME_TYPE],
    },
  },
} as Parameters<Client["registerCapabilities"]>[0];

function loadSandboxProxy(
  sandboxUrl: string,
  csp: McpUiResourceCsp | undefined,
  permissions: McpUiResourcePermissions | undefined
): Promise<HTMLIFrameElement> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "width:100%;height:100%;border:none;background-color:transparent";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");

  const allow = buildAllowAttribute(permissions);
  if (allow) {
    iframe.setAttribute("allow", allow);
  }

  const readyPromise = new Promise<HTMLIFrameElement>((resolve) => {
    const listener = ({ source, data }: MessageEvent) => {
      if (
        source === iframe.contentWindow &&
        data?.method === "ui/notifications/sandbox-proxy-ready"
      ) {
        window.removeEventListener("message", listener);
        resolve(iframe);
      }
    };
    window.addEventListener("message", listener);
  });

  const url = new URL(sandboxUrl);
  if (csp) {
    url.searchParams.set("csp", JSON.stringify(csp));
  }
  iframe.src = url.href;
  document.body.appendChild(iframe);

  return readyPromise;
}

async function mountApp(
  iframe: HTMLIFrameElement,
  client: Client,
  tool: Tool,
  html: string,
  csp: McpUiResourceCsp | undefined,
  permissions: McpUiResourcePermissions | undefined,
  containerDimensions: HostConfig["containerDimensions"],
  args: Record<string, unknown>,
  callResultPromise: Promise<CallToolResult>,
  openedLinks: string[],
  messages: RecordedMessage[],
  modelContextUpdates: RecordedModelContextUpdate[],
  logMessages: RecordedLogMessage[],
  getOpenLinkHandler: () => ((url: string) => void) | null,
  onTeardownRequested: () => void
): Promise<AppBridge> {
  const serverCapabilities = client.getServerCapabilities();

  const bridge = new AppBridge(
    client,
    HOST_INFO,
    {
      openLinks: {},
      logging: {},
      message: {},
      updateModelContext: {},
      serverTools: serverCapabilities?.tools ?? undefined,
      serverResources: serverCapabilities?.resources ?? undefined,
      sandbox: csp || permissions ? { csp, permissions } : undefined,
    },
    {
      hostContext: {
        theme: "light",
        platform: "web",
        displayMode: "inline",
        availableDisplayModes: ["inline"],
        toolInfo: { tool },
        containerDimensions: containerDimensions ?? { maxHeight: 6000 },
      },
    }
  );

  bridge.onopenlink = async ({ url }) => {
    openedLinks.push(url);
    getOpenLinkHandler()?.(url);
    return {};
  };

  bridge.onmessage = async ({ role, content }) => {
    messages.push({ role, content });
    return {};
  };

  bridge.onupdatemodelcontext = async ({ content, structuredContent }) => {
    modelContextUpdates.push({ content, structuredContent });
    return {};
  };

  bridge.onloggingmessage = ({ level, logger, data }) => {
    logMessages.push({ level, logger, data });
  };

  bridge.onsizechange = ({ width, height }) => {
    if (width != null) iframe.style.width = `${width}px`;
    if (height != null) iframe.style.height = `${height}px`;
  };

  bridge.onrequestdisplaymode = async () => {
    return { mode: "inline" };
  };

  bridge.onrequestteardown = async () => {
    try {
      await bridge.teardownResource({ reason: TEARDOWN_REASON });
    } catch {
      // view may already be gone
    }
    onTeardownRequested();
  };

  const initializedPromise = new Promise<void>((resolve) => {
    bridge.oninitialized = () => resolve();
  });

  await bridge.connect(
    new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!)
  );

  await bridge.sendSandboxResourceReady({ html, csp, permissions });
  await initializedPromise;

  await bridge.sendToolInput({ arguments: args });

  callResultPromise.then(
    (result) => bridge.sendToolResult(result),
    (error) =>
      bridge.sendToolCancelled({
        reason: error instanceof Error ? error.message : String(error),
      })
  );

  return bridge;
}

export function createHost(config: HostConfig): Host {
  return {
    async connect(): Promise<HostConnection> {
      const client = new Client(HOST_INFO);
      client.registerCapabilities(CLIENT_CAPABILITIES);

      const transport = new StreamableHTTPClientTransport(new URL(config.uri));
      await client.connect(transport);

      const [toolsList, resourcesList] = await Promise.all([
        client.listTools(),
        client.listResources(),
      ]);

      const tools = new Map(toolsList.tools.map((tool) => [tool.name, tool]));
      const resources = new Map(
        resourcesList.resources.map((resource) => [resource.uri, resource])
      );

      let activeBridge: AppBridge | null = null;
      let activeIframe: HTMLIFrameElement | null = null;
      let toolExecuted = false;
      const openedLinks: string[] = [];
      const messages: RecordedMessage[] = [];
      const modelContextUpdates: RecordedModelContextUpdate[] = [];
      const logMessages: RecordedLogMessage[] = [];

      const connection: HostConnection = {
        openedLinks,
        messages,
        modelContextUpdates,
        logMessages,
        onOpenLink: null,

        async executeTool(name, args) {
          if (toolExecuted) {
            throw new Error(
              "executeTool() can only be called once per connection. " +
                "Follow-up tool calls should be made by the view through the AppBridge."
            );
          }
          toolExecuted = true;

          const tool = tools.get(name);
          if (!tool) {
            throw new Error(`Unknown tool: "${name}"`);
          }

          const uiResourceUri = getToolUiResourceUri(tool);

          const callResultPromise = client.callTool({
            name,
            arguments: args,
          }) as Promise<CallToolResult>;

          const [callResult, uiResource] = await Promise.all([
            callResultPromise,
            uiResourceUri ?
              client.readResource({ uri: uiResourceUri })
            : Promise.resolve(null),
          ]);

          if (uiResource) {
            if (!config.sandboxUrl) {
              throw new Error(
                `Tool "${name}" returned a UI resource but no sandboxUrl was configured. ` +
                  `Pass sandboxUrl to createHost() to enable iframe mounting.`
              );
            }

            if (uiResource.contents.length !== 1) {
              throw new Error(
                `Expected exactly 1 content item in UI resource, got ${uiResource.contents.length}`
              );
            }

            const content = uiResource.contents[0]!;
            if (content.mimeType !== RESOURCE_MIME_TYPE) {
              throw new Error(
                `Unexpected MIME type for UI resource: "${content.mimeType}"`
              );
            }

            const html = "blob" in content ? atob(content.blob) : content.text;

            // Content-level metadata takes precedence over listing-level
            const contentMeta = (
              content as {
                _meta?: {
                  ui?: {
                    csp?: McpUiResourceCsp;
                    permissions?: McpUiResourcePermissions;
                  };
                };
              }
            )._meta;
            const listingMeta = (
              resources.get(uiResourceUri!) as
                | {
                    _meta?: {
                      ui?: {
                        csp?: McpUiResourceCsp;
                        permissions?: McpUiResourcePermissions;
                      };
                    };
                  }
                | undefined
            )?._meta;
            const uiMeta = contentMeta?.ui ?? listingMeta?.ui;

            const iframe = await loadSandboxProxy(
              config.sandboxUrl,
              uiMeta?.csp,
              uiMeta?.permissions
            );

            activeBridge = await mountApp(
              iframe,
              client,
              tool,
              html,
              uiMeta?.csp,
              uiMeta?.permissions,
              config.containerDimensions,
              args,
              callResultPromise,
              openedLinks,
              messages,
              modelContextUpdates,
              logMessages,
              () => connection.onOpenLink,
              () => {
                iframe.remove();
                activeIframe = null;
                activeBridge = null;
              }
            );
            activeIframe = iframe;

            return { result: callResult, view: iframe };
          }

          return { result: callResult, view: null };
        },

        async teardown() {
          if (activeBridge) {
            try {
              await activeBridge.teardownResource({ reason: TEARDOWN_REASON });
            } catch {
              // view may already be gone
            }
            activeBridge = null;
          }
          if (activeIframe) {
            activeIframe.remove();
            activeIframe = null;
          }
          await client.close();
        },
      };

      return connection;
    },
  };
}
