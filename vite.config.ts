import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src",
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    // Don't clean files built from `tsc`.
    emptyOutDir: false,
    rolldownOptions: {
      input: {
        sandbox: resolve(import.meta.dirname, "src/sandbox/sandbox.html"),
      },
    },
  },
  plugins: [viteSingleFile()],
});
