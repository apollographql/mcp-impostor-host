import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const input: Record<string, string> =
    mode === "harness"
      ? {
          harness: resolve(
            import.meta.dirname,
            "src/playwright/harness/harness.html",
          ),
        }
      : { sandbox: resolve(import.meta.dirname, "src/sandbox/sandbox.html") };

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
