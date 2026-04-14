import { expect } from "@playwright/test";

import { test } from "../src/playwright/index.js";

const MCP_URL = "http://localhost:3456/mcp";

test("hello tool renders Hello world in iframe", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({ url: MCP_URL });
  const { result, appFrame } = await connection.callTool("hello", {});

  expect(result.isError).toBeFalsy();
  await expect(appFrame.locator("h1")).toHaveText("Hello world");
});

test("greet tool renders greeting with name argument", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({ url: MCP_URL });
  const { result, appFrame } = await connection.callTool("greet", {
    name: "Playwright",
  });

  expect(result.isError).toBeFalsy();
  await expect(appFrame.locator("#greeting")).toHaveText("Hello, Playwright!");
});

test("host context defaults are provided to the view", async ({ mcpHost }) => {
  const connection = await mcpHost.connect({ url: MCP_URL });
  const { appFrame } = await connection.callTool("host-context", {});

  // useHostContext provides defaults derived from the browser
  await expect(appFrame.locator("#theme")).toHaveText(/^(light|dark)$/);
  await expect(appFrame.locator("#locale")).not.toHaveText("Loading...");
  await expect(appFrame.locator("#timeZone")).not.toHaveText("Loading...");
});

test("setHostContext before tool call sets initial context", async ({
  mcpHost,
}) => {
  await mcpHost.setHostContext({ theme: "dark" });
  const connection = await mcpHost.connect({ url: MCP_URL });
  const { appFrame } = await connection.callTool("host-context", {});

  await expect(appFrame.locator("#theme")).toHaveText("dark");
});

test("setHostContext after tool call updates context dynamically", async ({
  mcpHost,
}) => {
  await mcpHost.setHostContext({ theme: "dark" });
  const connection = await mcpHost.connect({ url: MCP_URL });
  const { appFrame } = await connection.callTool("host-context", {});

  await expect(appFrame.locator("#theme")).toHaveText("dark");

  mcpHost.setHostContext({ theme: "light" });

  await expect(appFrame.locator("#theme")).toHaveText("light");
});
