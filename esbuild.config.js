import * as esbuild from "esbuild";

await Promise.all([
  esbuild.build({
    entryPoints: ["src/browser/entry.ts"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "esnext",
    outfile: "dist/browser/host.bundle.js",
    sourcemap: true,
  }),
  esbuild.build({
    entryPoints: ["src/sandbox.ts"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "esnext",
    outfile: "dist/sandbox.bundle.js",
  }),
]);
