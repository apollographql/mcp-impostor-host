import { test } from "../src/playwright/index.js";
import { expect } from "@playwright/test";

test("fixture sets up window.__mcpHost on the page", async ({ page }) => {
  // mcpHost fixture handles page.route + addInitScript + goto
  const hasApi = await page.evaluate(() => {
    const host = (window as unknown as { __mcpHost?: unknown }).__mcpHost;
    return host != null && typeof host === "object";
  });

  expect(hasApi).toBe(true);
});

test("fixture exposes connect, executeTool, teardown on window", async ({
  page,
}) => {
  const methods = await page.evaluate(() => {
    const host = (window as unknown as { __mcpHost: Record<string, unknown> })
      .__mcpHost;
    return {
      connect: typeof host.connect,
      executeTool: typeof host.executeTool,
      getOpenedLinks: typeof host.getOpenedLinks,
      teardown: typeof host.teardown,
    };
  });

  expect(methods).toEqual({
    connect: "function",
    executeTool: "function",
    getOpenedLinks: "function",
    teardown: "function",
  });
});

test("mcpHost fixture provides typed API", async ({ mcpHost }) => {
  expect(mcpHost).toBeDefined();
  expect(typeof mcpHost.connect).toBe("function");
  expect(typeof mcpHost.executeTool).toBe("function");
  expect(typeof mcpHost.getOpenedLinks).toBe("function");
});

test("getOpenedLinks returns empty array before connect", async ({
  mcpHost,
}) => {
  const links = await mcpHost.getOpenedLinks();
  expect(links).toEqual([]);
});
