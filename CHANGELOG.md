# @apollo/mcp-impostor-host

## 0.2.1

### Patch Changes

- [#30](https://github.com/apollographql/mcp-impostor-host/pull/30) [`eef87a3`](https://github.com/apollographql/mcp-impostor-host/commit/eef87a3fe434a9ff2e590d02369796eb4bc88e17) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add a README with installation and usage instructions.

## 0.2.0

### Minor Changes

- [#27](https://github.com/apollographql/mcp-impostor-host/pull/27) [`ca10cd4`](https://github.com/apollographql/mcp-impostor-host/commit/ca10cd4b04c440bedd1bedc2dd9434db67f203b9) Thanks [@jerelmiller](https://github.com/jerelmiller)! - Add support for message requests and open link requests. Adds the ability to assert on these in playwright.

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
