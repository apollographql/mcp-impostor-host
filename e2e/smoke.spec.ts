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
