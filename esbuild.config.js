import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/browser/entry.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "esnext",
  outfile: "dist/browser/host.bundle.js",
  sourcemap: true,
});
