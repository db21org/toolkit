import { resolve } from "node:path";

import { validateGraphqlFile } from "./graphql-conventions.mjs";

const sources = new Map();

export const createFeatureGraphqlPlugin = (appRoot, layout) => ({
  processors: {
    conventions: {
      meta: {
        name: "feature-graphql/conventions",
        version: "1.0.0",
      },
      postprocess(_messageLists, filePath) {
        const absolutePath = resolve(filePath);
        const source = sources.get(absolutePath) ?? "";

        sources.delete(absolutePath);

        return validateGraphqlFile({
          appRoot,
          filePath: absolutePath,
          source,
          ...layout,
        }).map((issue) => ({
          ...issue,
          ruleId: "feature-graphql/conventions",
          severity: 2,
        }));
      },
      preprocess(source, filePath) {
        sources.set(resolve(filePath), source);

        return [""];
      },
      supportsAutofix: false,
    },
  },
});
