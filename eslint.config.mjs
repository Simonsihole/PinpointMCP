import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated package build output (see packages/pinpoint-react/tsup.config.ts) —
    // linting compiled/minified JS here produces noise, not real findings.
    "packages/*/dist/**",
    // pinpoint-mcp is a standalone plain Node/CommonJS server, not part of
    // this Next.js app — eslint-config-next's React/TS rules (e.g. banning
    // require()) don't apply to it. It can grow its own lint setup later.
    "packages/pinpoint-mcp/**",
    "packages/pinpoint-launcher/**",
  ]),
]);

export default eslintConfig;
