import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@db21\/toolkit\/feature-kit$/,
        replacement: new URL("./src/feature-kit/core/index.ts", import.meta.url)
          .pathname,
      },
      {
        find: /^@db21\/toolkit\/feature-kit\/react$/,
        replacement: new URL(
          "./src/feature-kit/react/index.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: /^@db21\/toolkit\/utils$/,
        replacement: new URL("./src/utils/index.ts", import.meta.url).pathname,
      },
      {
        find: /^@db21\/toolkit\/money$/,
        replacement: new URL("./src/money/index.ts", import.meta.url).pathname,
      },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx,mjs}"],
    passWithNoTests: false,
    restoreMocks: true,
  },
});
