import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const input: Record<string, string> | null =
    mode === "harness" ?
      {
        harness: resolve(
          import.meta.dirname,
          "src/playwright/harness/harness.html",
        ),
      }
    : mode === "sandbox" ?
      { sandbox: resolve(import.meta.dirname, "src/sandbox/sandbox.html") }
    : null;

  if (!input) {
    throw new Error("Must set --mode");
  }

  return {
    root: "src",
    build: {
      outDir: resolve(import.meta.dirname, "dist"),
      // Don't clean files built from `tsc`.
      emptyOutDir: false,
      rolldownOptions: {
        input,
      },
    },
    plugins: [viteSingleFile()],
  };
});
