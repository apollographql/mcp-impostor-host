import { test } from "../src/playwright/index.js";
import { expect } from "@playwright/test";

const MCP_URI = "http://localhost:3456/mcp";

test("hello tool renders Hello world in iframe", async ({ mcpHost }) => {
  await mcpHost.connect({ uri: MCP_URI });
  const { result, hasView, appFrame } = await mcpHost.executeTool(
    "hello",
    {}
  );

  expect(result.isError).toBeFalsy();
  expect(hasView).toBe(true);
  await expect(appFrame!.locator("h1")).toHaveText("Hello world");
});

test("greet tool renders greeting with name argument", async ({ mcpHost }) => {
  await mcpHost.connect({ uri: MCP_URI });
  const { result, hasView, appFrame } = await mcpHost.executeTool("greet", {
    name: "Playwright",
  });

  expect(result.isError).toBeFalsy();
  expect(hasView).toBe(true);
  await expect(appFrame!.locator("#greeting")).toHaveText(
    "Hello, Playwright!"
  );
});
