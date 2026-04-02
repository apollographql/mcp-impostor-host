import { test } from "../src/playwright/index.js";
import { expect } from "@playwright/test";

const MCP_URI = "http://localhost:3456/mcp";

test("hello tool renders Hello world in iframe", async ({ page, mcpHost }) => {
  await mcpHost.connect({ uri: MCP_URI });
  const { result, hasView } = await mcpHost.executeTool("hello", {});

  expect(result.isError).toBeFalsy();
  expect(hasView).toBe(true);

  // Double iframe: outer sandbox proxy → inner app
  const app = page
    .frameLocator("iframe")
    .first()
    .frameLocator("iframe")
    .first();
  await expect(app.locator("h1")).toHaveText("Hello world");
});

test("greet tool renders greeting with name argument", async ({
  page,
  mcpHost,
}) => {
  await mcpHost.connect({ uri: MCP_URI });
  const { result, hasView } = await mcpHost.executeTool("greet", {
    name: "Playwright",
  });

  expect(result.isError).toBeFalsy();
  expect(hasView).toBe(true);

  const app = page
    .frameLocator("iframe")
    .first()
    .frameLocator("iframe")
    .first();
  await expect(app.locator("#greeting")).toHaveText("Hello, Playwright!");
});
