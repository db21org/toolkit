import { createCoreEslintConfig } from "@db21/toolkit/feature-kit/conventions/core/eslint";

const reactRoles = Object.freeze(
  [
    {
      case: "kebab",
      extensions: [".ts"],
      folder: "queries",
      recursive: false,
      suffix: ".query",
    },
    {
      case: "kebab",
      extensions: [".tsx"],
      folder: "react-providers",
      recursive: false,
      suffix: ".react-provider",
    },
    {
      case: "pascal",
      extensions: [".tsx"],
      folder: "surfaces",
      recursive: false,
      suffix: ".surface",
    },
    {
      case: "kebab",
      extensions: [".ts", ".tsx"],
      folder: "hooks",
      recursive: true,
      suffix: ".hook",
    },
  ].map((role) =>
    Object.freeze({
      ...role,
      extensions: Object.freeze(role.extensions),
    }),
  ),
);

const reactProviderFilePattern =
  /(?:^|\/)react-providers\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.react-provider\.tsx$/u;

const surfaceClassFilePattern =
  /(?:^|\/)surfaces\/[A-Z][A-Za-z0-9]*\.surface\.tsx$/u;

const isSurfaceDecorator = (node) => {
  if (node.type !== "Decorator" || node.expression.type !== "CallExpression") {
    return false;
  }

  return (
    node.expression.callee.type === "Identifier" &&
    node.expression.callee.name === "Surface"
  );
};

const forbiddenSurfaceSources = new Set([
  "react-native",
  "react-i18next",
  "expo-router",
  "@react-navigation",
  "react-providers",
  "hooks",
  "queries",
]);

const isForbiddenSurfaceImportSource = (source) =>
  forbiddenSurfaceSources.has(source) ||
  source.startsWith("@react-navigation/") ||
  /(?:^|\/)(?:react-providers|hooks|queries)(?:\/$|\/.+$)/u.test(source);

const reactProviderFilenameRule = {
  meta: {
    docs: {
      description: "Keep React provider registrations in dedicated role files.",
    },
    messages: {
      invalidFilename:
        "reactProvider() registrations must live under react-providers/ and use a kebab-case name.react-provider.tsx filename.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");

    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "reactProvider" &&
          !reactProviderFilePattern.test(filename)
        ) {
          context.report({ messageId: "invalidFilename", node });
        }
      },
    };
  },
};

const surfaceClassFilenameRule = {
  meta: {
    docs: {
      description: "Keep Surface classes in dedicated role files.",
    },
    messages: {
      invalidFilename:
        "@Surface() classes must live under surfaces/ and use a PascalCase filename ending in .surface.tsx.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");

    if (filename === "<text>" || filename === "<input>") {
      return {};
    }

    return {
      Decorator(node) {
        if (
          isSurfaceDecorator(node) &&
          !surfaceClassFilePattern.test(filename)
        ) {
          context.report({ messageId: "invalidFilename", node });
        }
      },
    };
  },
};

const surfaceDependencyRule = {
  meta: {
    docs: {
      description:
        "Keep Surface classes free of visual/platform/rendering module dependencies.",
    },
    messages: {
      invalidImport:
        "Surface files should be DI/render wiring only and must not import react-native, react-i18next, expo-router, @react-navigation, hooks/, queries/, or react-providers/.",
    },
    schema: [],
    type: "problem",
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");

    if (
      filename === "<text>" ||
      filename === "<input>" ||
      !surfaceClassFilePattern.test(filename)
    ) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        if (
          typeof node.source.value === "string" &&
          isForbiddenSurfaceImportSource(node.source.value)
        ) {
          context.report({ messageId: "invalidImport", node });
        }
      },
    };
  },
};

export const featureKitReactEslintPlugin = {
  rules: {
    "react-provider-filename": reactProviderFilenameRule,
    "surface-class-filename": surfaceClassFilenameRule,
    "surface-dependencies": surfaceDependencyRule,
  },
};

export const createReactEslintConfig = ({
  additionalRoles = [],
  cwd,
  moduleRoots,
}) => {
  const coreConfig = createCoreEslintConfig({
    additionalRoles: [...reactRoles, ...additionalRoles],
    cwd,
    moduleRoots,
  });

  return {
    ...coreConfig,
    name: "feature-kit/react/recommended",
    plugins: {
      ...coreConfig.plugins,
      "feature-kit-react": featureKitReactEslintPlugin,
    },
    rules: {
      ...coreConfig.rules,
      "feature-kit-react/react-provider-filename": "error",
      "feature-kit-react/surface-class-filename": "error",
      "feature-kit-react/surface-dependencies": "error",
    },
  };
};

export const reactRoleConventions = reactRoles;
