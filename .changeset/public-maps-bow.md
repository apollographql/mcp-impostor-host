---
"@apollo/mcp-impostor-host": minor
---

Add support for message requests and open link requests. Adds the ability to assert on these in playwright.

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
