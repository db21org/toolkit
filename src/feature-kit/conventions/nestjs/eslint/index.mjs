import { createCoreEslintConfig } from "@db21/toolkit/feature-kit/conventions/core/eslint";

const dtoFolderPattern = /(?:^|\/)dto\//u;
const inputDtoPattern =
  /(?:^|\/)dto\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.input\.dto\.ts$/u;

const outputDtoPattern =
  /(?:^|\/)dto\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.output\.dto\.ts$/u;

const dtoPattern =
  /(?:^|\/)dto\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.(?:input|output)\.dto\.ts$/u;

const dtoFilenameRule = {
  meta: {
    docs: {
      description:
        "Require directional name.input.dto.ts or name.output.dto.ts filenames in DTO folders.",
    },
    messages: {
      invalidDtoFilename:
        "Files under dto/ must use a kebab-case name.input.dto.ts or name.output.dto.ts filename.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      Program(node) {
        const filename = context.filename.replaceAll("\\", "/");

        if (dtoFolderPattern.test(filename) && !dtoPattern.test(filename)) {
          context.report({ messageId: "invalidDtoFilename", node });
        }
      },
    };
  },
};

const inputDtoFilenameRule = {
  meta: {
    docs: {
      description:
        "Require NestJS GraphQL input DTOs to use name.input.dto.ts filenames.",
    },
    messages: {
      invalidInputDtoFilename:
        "GraphQL @InputType DTOs must live under dto/ and use a kebab-case name.input.dto.ts filename.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      Program(node) {
        const source = context.sourceCode.getText();
        const filename = context.filename.replaceAll("\\", "/");

        if (source.includes("@InputType") && !inputDtoPattern.test(filename)) {
          context.report({ messageId: "invalidInputDtoFilename", node });
        }
      },
    };
  },
};

const outputDtoFilenameRule = {
  meta: {
    docs: {
      description:
        "Require NestJS GraphQL output DTOs to use name.output.dto.ts filenames.",
    },
    messages: {
      invalidOutputDtoFilename:
        "GraphQL @ObjectType DTOs must live under dto/ and use a kebab-case name.output.dto.ts filename.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    return {
      Program(node) {
        const source = context.sourceCode.getText();
        const filename = context.filename.replaceAll("\\", "/");

        if (
          source.includes("@ObjectType") &&
          !outputDtoPattern.test(filename)
        ) {
          context.report({ messageId: "invalidOutputDtoFilename", node });
        }
      },
    };
  },
};

const nestjsRoleDefinitions = [
  ["context", ".context"],
  ["controllers", ".controller"],
  ["decorators", ".decorator"],
  ["guards", ".guard"],
  ["loaders", ".loader"],
  ["mappers", ".mapper"],
  ["pipes", ".pipe"],
  ["processors", ".processor"],
  ["resolvers", ".resolver"],
  ["repositories", ".repository"],
  ["scalars", ".scalar"],
  ["schemas", ".schema"],
  ["types", ".type"],
  ["utils", ".util"],
];

const nestjsRoles = Object.freeze(
  nestjsRoleDefinitions.map(([folder, suffix]) =>
    Object.freeze({
      case: "kebab",
      extensions: Object.freeze([".ts"]),
      folder,
      recursive: false,
      suffix,
    }),
  ),
);

const nestjsFolders = Object.freeze([
  "context",
  "controllers",
  "decorators",
  "dto",
  "guards",
  "loaders",
  "mappers",
  "pipes",
  "processors",
  "repositories",
  "resolvers",
  "scalars",
  "schemas",
  "services",
  "types",
  "utils",
]);

export const createNestjsEslintConfig = ({
  additionalRoles = [],
  cwd,
  moduleRoots,
}) => {
  const coreConfig = createCoreEslintConfig({
    additionalRoles: [...nestjsRoles, ...additionalRoles],
    allowedFolders: [
      ...nestjsFolders,
      ...additionalRoles.map(({ folder }) => folder),
    ],
    cwd,
    moduleRoots,
  });

  return {
    ...coreConfig,
    name: "feature-kit/nestjs/recommended",
    plugins: {
      ...coreConfig.plugins,
      "feature-kit-nestjs": {
        rules: {
          "dto-filename": dtoFilenameRule,
          "input-dto-filename": inputDtoFilenameRule,
          "output-dto-filename": outputDtoFilenameRule,
        },
      },
    },
    rules: {
      ...coreConfig.rules,
      "feature-kit-nestjs/dto-filename": "error",
      "feature-kit-nestjs/input-dto-filename": "error",
      "feature-kit-nestjs/output-dto-filename": "error",
    },
  };
};

export const nestjsRoleConventions = nestjsRoles;
export const nestjsFolderConventions = nestjsFolders;
