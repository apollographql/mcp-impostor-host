<header>
  <div align="center">
    <a href="https://www.apollographql.com?utm_medium=github&utm_source=apollographql_apollo-client&utm_campaign=readme"><img src="https://raw.githubusercontent.com/apollographql/apollo-client-devtools/main/assets/apollo-wordmark.svg" height="100" alt="Apollo Logo"></a>
  </div>
  <h1 align="center">@apollo/mcp-impostor-host</h1>
</header>

A test host that impersonates a real MCP Apps host (like Claude Desktop) so you can end-to-end test your Tool UIs without a real host.

## Installation

```sh
npm install --save-dev @apollo/mcp-impostor-host
```

If you plan to use the Playwright test fixture, install Playwright as well:

```sh
npm install --save-dev @playwright/test
npx playwright install
```

## Playwright Configuration

The package includes a server that serves the sandbox and a prebuilt test harness. Configure Playwright to start it automatically using the `webServer` option in your `playwright.config.ts`:

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
      url: "http://localhost:8000/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

By default, the sandbox server runs on port `8080`. Set the `SANDBOX_PORT` environment variable to use a different port.

## Usage

Import `test` from `@apollo/mcp-impostor-host/playwright` instead of `@playwright/test`. This provides the `mcpHost` fixture for connecting to your MCP server and calling tools.

### Calling a tool and asserting on the UI

```ts
import { test } from "@apollo/mcp-impostor-host/playwright";
import { expect } from "@playwright/test";

test("displays weather results", async ({ mcpHost }) => {
  // First, connect to the MCP server
  const connection = await mcpHost.connect({
    url: "http://localhost:3000/mcp",
  });

  // Call a tool that includes a UI resource. The UI resource will automatically
  // render for you by the test harness
  const { result, input, appFrame } = await connection.callTool("weather", {
    city: "Portland",
  });

  // `result` is the tool call result.
  expect(result.isError).toBeFalsy();

  // `input` is the tool input provided to the tool call
  expect(input).toEqual({ city: "Portland" });

  // `appFrame` is the iframe locator for your app. Use it to make assertions
  // about your UI
  await expect(appFrame.locator("h1")).toHaveText("Weather for Portland");
});
```

### Waiting for a message request

When the MCP app sends a message back to the host via `app.sendMessage`, use `waitForMessageRequest` to assert on it. Messages are queued in order, so you can safely await them sequentially.

```ts
test("sends a message when the user submits feedback", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({
    url: "http://localhost:3000/mcp",
  });

  const { appFrame } = await connection.callTool("weather", {
    city: "Portland",
  });

  await appFrame.getByRole("button", { name: "Inspire me" }).click();

  // Use `connection.waitForMessageRequest` to capture the message request
  const message = await connection.waitForMessageRequest();

  // Assert on the message that was sent from the app
  expect(message).toEqual({
    role: "user",
    content: [
      {
        type: "text",
        text: "Based on what you know about me, give me some inspiration",
      },
    ],
  });
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

  await appFrame.getByRole("button", { text: "View full forecast" }).click();

  // Use `connection.waitForOpenLinkRequest` to capture the open link request
  const link = await connection.waitForOpenLinkRequest();

  expect(link).toEqual({
    url: "https://weather.example.com/portland",
  });
});
```

All received open link requests are available on `connection.openLinkRequests`.

### Timeouts

Both `waitForMessageRequest` and `waitForOpenLinkRequest` default to a 5000ms timeout. Override it per-call:

```ts
const message = await connection.waitForMessageRequest({ timeout: 10000 });
```

## Custom setups

For advanced use cases, the package also exports `Host` and `Sandbox` for building your own host setup:

```ts
import { Host } from "@apollo/mcp-impostor-host";
import { Sandbox } from "@apollo/mcp-impostor-host/react";
```
