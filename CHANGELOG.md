# @apollo/mcp-impostor-host

## 0.3.0

### Minor Changes

- [#34](https://github.com/apollographql/mcp-impostor-host/pull/34) [`d7e0286`](https://github.com/apollographql/mcp-impostor-host/commit/d7e0286adcf8d2ea27505e79c043b51c37822ca9) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for configuring and dynamically updating host context.

  ### `<Sandbox />` manages `hostContext`

  Provide host context to the `hostContext` prop. The initial host context is sent to the view as a response to its `ui/initialize` notification. Subsequent updates are sent to the view via a `ui/notifications/host-context-changed` notification.

  ### `useHostContext` hook

  A new `useHostContext` hook is available from `@apollo/mcp-impostor-host/react`. It provides sensible browser defaults for `platform`, `theme`, `locale`, and `timeZone`, and returns a shallow-merge setter for updates.

  ```jsx
  import { Sandbox, useHostContext } from "@apollo/mcp-impostor-host/react";

  function MyTestPage({ connection, execution }) {
    const [hostContext, setHostContext] = useHostContext({ theme: "dark" });

    return (
      <>
        <button onClick={() => setHostContext({ theme: "light" })}>
          Switch to light mode
        </button>
        <Sandbox
          connection={connection}
          execution={execution}
          hostContext={hostContext}
          url="http://localhost:8080/sandbox.html"
        />
      </>
    );
  }
  ```

  ### Playwright fixture

  Use `mcpHost.setHostContext` to configure host context in your Playwright tests. Call it before `connection.callTool` to set the initial host context, which is sent to the view as a response to its `ui/initialize` notification. Call `mcpHost.setHostContext` after `connection.callTool` to notify the view of updates to the host context via a `ui/notifications/host-context-changed` notification.

  ```ts
  import { test } from "@apollo/mcp-impostor-host/playwright";
  import { expect } from "@playwright/test";

  test("app responds to theme changes", async ({ mcpHost }) => {
    // Set initial host context before connecting
    await mcpHost.setHostContext({ theme: "dark" });

    const connection = await mcpHost.connect({
      url: "http://localhost:3000/mcp",
    });

    const { appFrame } = await connection.callTool("my-tool", {});

    await expect(appFrame.locator("#theme")).toHaveText("dark");

    // Dynamically update host context. Sends a ui/notifications/host-context-changed notification
    await mcpHost.setHostContext({ theme: "light" });

    await expect(appFrame.locator("#theme")).toHaveText("light");
  });
  ```

  ### Potentially breaking change

  The `<Sandbox />` component's `connection` and `execution` props are now non-nullable. If you were passing `null` for either of these, conditionally render `<Sandbox />` instead:

  ```tsx
  // Before
  <Sandbox connection={connection} execution={execution} url={url} />;

  // After
  connection && execution && (
    <Sandbox connection={connection} execution={execution} url={url} />
  );
  ```

### Patch Changes

- [#37](https://github.com/apollographql/mcp-impostor-host/pull/37) [`a58ccd0`](https://github.com/apollographql/mcp-impostor-host/commit/a58ccd0246c08f1142d1aab102a08b27a6578859) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Remove `@mcp-ui/client` as a dependency as it is no longer required.

## 0.2.1

### Patch Changes

- [#30](https://github.com/apollographql/mcp-impostor-host/pull/30) [`eef87a3`](https://github.com/apollographql/mcp-impostor-host/commit/eef87a3fe434a9ff2e590d02369796eb4bc88e17) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add a README with installation and usage instructions.

## 0.2.0

### Minor Changes

- [#27](https://github.com/apollographql/mcp-impostor-host/pull/27) [`ca10cd4`](https://github.com/apollographql/mcp-impostor-host/commit/ca10cd4b04c440bedd1bedc2dd9434db67f203b9) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for message requests and open link requests. Adds the ability to assert on these in playwright.

  ```ts
  import { test } from "@apollo/mcp-impostor-host/playwright";

  test("gets a message request", async ({ mcpHost }) => {
    // ...
    const message = await connection.waitForMessageRequest();

    expect(message).toEqual({
      role: "user",
      content: [{ type: "text", text: "Hello, world" }],
    });
  });

  test("gets a link request", async ({ mcpHost }) => {
    // ...
    const link = await connection.waitForOpenLinkRequest();

    expect(link).toEqual({ url: "https://example.com" });
  });
  ```

## 0.1.0

### Minor Changes

- [#22](https://github.com/apollographql/mcp-impostor-host/pull/22) [`57e56a4`](https://github.com/apollographql/mcp-impostor-host/commit/57e56a43423033c587b43b1b96b382ffa13fbad9) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Initial release
