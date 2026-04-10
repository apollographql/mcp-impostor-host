# @apollo/mcp-impostor-host

## 0.2.0

### Minor Changes

- [#25](https://github.com/apollographql/mcp-impostor-host/pull/25) [`2d094c0`](https://github.com/apollographql/mcp-impostor-host/commit/2d094c09b756aa9bae93058551b2746cd3d591c7) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for message requests and open link requests. Adds the ability to assert on these in playwright.

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

## 0.1.0

### Minor Changes

- [#22](https://github.com/apollographql/mcp-impostor-host/pull/22) [`57e56a4`](https://github.com/apollographql/mcp-impostor-host/commit/57e56a43423033c587b43b1b96b382ffa13fbad9) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Initial release
