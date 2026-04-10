<header>
  <div align="center">
    <a href="https://www.apollographql.com?utm_medium=github&utm_source=apollographql_apollo-client&utm_campaign=readme"><img src="https://raw.githubusercontent.com/apollographql/apollo-client-devtools/main/assets/apollo-wordmark.svg" height="100" alt="Apollo Logo"></a>
  </div>
  <h1 align="center">@apollo/mcp-impostor-host</h1>
</header>

A test host that impersonates a real MCP Apps host (like Claude Desktop) so you can end-to-end test your Tool UIs without a real host.

## Installation

```sh
npm install @apollo/mcp-impostor-host
```

If you plan to use the Playwright test fixture, install Playwright as well:

```sh
npm install -D @playwright/test
```

## Playwright Configuration

The package includes a server that serves the sandbox and test harness. Configure Playwright to start it automatically using the `webServer` option in your `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: [
    {
      command: "npx serve-impostor-host --playwright",
      url: "http://localhost:8080",
      reuseExistingServer: !process.env.CI,
    },
    {
      // Start your MCP server as well
      command: "your-mcp-server-start-command",
      url: "http://localhost:3000/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

By default, the server runs on port `8080`. Set the `SANDBOX_PORT` environment variable to use a different port.

## Usage

Import `test` from `@apollo/mcp-impostor-host/playwright` instead of `@playwright/test`. This provides the `mcpHost` fixture for connecting to your MCP server and calling tools.

### Calling a tool and asserting on the UI

```ts
import { test } from "@apollo/mcp-impostor-host/playwright";
import { expect } from "@playwright/test";

test("displays weather results", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({
    url: "http://localhost:3000/mcp",
  });

  const { result, appFrame } = await connection.callTool("weather", {
    city: "Portland",
  });

  expect(result.isError).toBeFalsy();
  await expect(appFrame.locator("h1")).toHaveText("Weather for Portland");
});
```

### Waiting for a message request

When the MCP app sends a message back to the host via `app.sendMessage`, use `waitForMessageRequest` to assert on it. Messages are queued in order, so you can safely await them sequentially without missing any.

```ts
test("sends a message when the user submits feedback", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({
    url: "http://localhost:3000/mcp",
  });

  const { appFrame } = await connection.callTool("weather", {
    city: "Portland",
  });

  await appFrame.locator('button:has-text("Send feedback")').click();

  const message = await connection.waitForMessageRequest();

  expect(message.content).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: "text", text: expect.any(String) }),
    ]),
  );
});
```

All received messages are also available on `connection.messageRequests` for retrospective assertions.

### Waiting for an open link request

When the MCP app requests to open a link via `app.openLink`, use `waitForOpenLinkRequest` to assert on it.

```ts
test("opens documentation link", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({
    url: "http://localhost:3000/mcp",
  });

  const { appFrame } = await connection.callTool("weather", {
    city: "Portland",
  });

  await appFrame.locator('a:has-text("View full forecast")').click();

  const openLinkRequest = await connection.waitForOpenLinkRequest();

  expect(openLinkRequest.url).toBe("https://weather.example.com/portland");
});
```

All received open link requests are available on `connection.openLinkRequests`.

### Timeouts

Both `waitForMessageRequest` and `waitForOpenLinkRequest` default to a 5000ms timeout. Override it per-call:

```ts
const message = await connection.waitForMessageRequest({ timeout: 10000 });
```

## Custom setups

For advanced use cases that don't use the Playwright fixture, the package also exports `Host` and `Sandbox` for building your own host setup:

```ts
import { Host } from "@apollo/mcp-impostor-host";
import { Sandbox } from "@apollo/mcp-impostor-host/react";
```
