import { test } from "../src/playwright/index.js";
import { expect } from "@playwright/test";

const MCP_URL = "http://localhost:3456/mcp";

test("hello tool renders Hello world in iframe", async ({ mcpHost }) => {
  await mcpHost.connect(MCP_URL);
  const { result, appFrame } = await mcpHost.callTool("hello", {});

  expect(result.isError).toBeFalsy();
  await expect(appFrame.locator("h1")).toHaveText("Hello world");
});

test("greet tool renders greeting with name argument", async ({ mcpHost }) => {
  await mcpHost.connect(MCP_URL);
  const { result, appFrame } = await mcpHost.callTool("greet", {
    name: "Playwright",
  });

  expect(result.isError).toBeFalsy();
  await expect(appFrame.locator("#greeting")).toHaveText("Hello, Playwright!");
});
