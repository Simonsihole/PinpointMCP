import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.tsx"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2019",
  // index.tsx starts with "use client" — Next.js's App Router needs that
  // directive literally at the top of the compiled output too, or importing
  // this into a Server Component (e.g. app/layout.tsx) breaks with a
  // "useState only works in a Client Component" error.
  banner: {
    js: '"use client";',
  },
  external: ["react", "react-dom"],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
