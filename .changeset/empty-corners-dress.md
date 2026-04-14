---
"@apollo/mcp-impostor-host": minor
---

Add support for configuring and dynamically updating host context.

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
