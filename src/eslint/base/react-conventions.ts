import { isDefined } from "@db21/toolkit/utils";
import {
  AST_NODE_TYPES,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";

const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

type RuleModule = TSESLint.RuleModule<string, readonly unknown[]>;
type RuleContext = Readonly<TSESLint.RuleContext<string, readonly unknown[]>>;
type RuleListener = TSESLint.RuleListener;
type TypeName = TSESTree.EntityName;

const getTypeName = (typeName: TypeName): string => {
  if (typeName.type === AST_NODE_TYPES.Identifier) {
    return typeName.name;
  }

  if (typeName.type === AST_NODE_TYPES.TSQualifiedName) {
    return `${getTypeName(typeName.left)}.${getTypeName(typeName.right)}`;
  }

  return "this";
};

const isDirectlyExported = (node: TSESTree.VariableDeclarator): boolean =>
  node.parent.parent.type === AST_NODE_TYPES.ExportNamedDeclaration;

const isFcAnnotated = (node: TSESTree.VariableDeclarator): boolean => {
  const annotation = node.id.typeAnnotation?.typeAnnotation;

  if (annotation?.type !== AST_NODE_TYPES.TSTypeReference) {
    return false;
  }

  const typeName = getTypeName(annotation.typeName);

  return ["FC", "React.FC"].includes(typeName);
};

const report = (
  context: RuleContext,
  node: TSESTree.Node,
  message: string,
): void => {
  context.report({
    node,
    messageId: "ruleViolation",
    data: { message },
  });
};

const componentStyleRule: RuleModule = {
  create(context): RuleListener {
    return {
      FunctionDeclaration(node): void {
        if (isDefined(node.id) && PASCAL_CASE.test(node.id.name)) {
          report(
            context,
            node,
            "React components should be typed exported const arrow functions, not function declarations.",
          );
        }
      },
      VariableDeclarator(node): void {
        if (
          node.id.type !== AST_NODE_TYPES.Identifier ||
          !PASCAL_CASE.test(node.id.name) ||
          node.init?.type !== AST_NODE_TYPES.ArrowFunctionExpression
        ) {
          return;
        }

        if (!isDirectlyExported(node)) {
          report(
            context,
            node,
            "React components should be exported directly at declaration time with `export const ComponentName...`.",
          );
        }

        if (!isFcAnnotated(node)) {
          report(
            context,
            node,
            "React components should be annotated with `FC<Props>` or `React.FC<Props>`.",
          );
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description:
        "Require React components to use typed exported const arrow functions.",
    },
    messages: {
      ruleViolation: "{{message}}",
    },
    schema: [],
    type: "suggestion",
  },
};

const noImportedPropsTypesRule: RuleModule = {
  create(context): RuleListener {
    return {
      ImportDeclaration(node): void {
        for (const specifier of node.specifiers) {
          if (
            specifier.type === AST_NODE_TYPES.ImportSpecifier &&
            specifier.imported.type === AST_NODE_TYPES.Identifier &&
            specifier.imported.name.endsWith("Props")
          ) {
            report(
              context,
              specifier,
              "Component props types should be declared in the same file as the component that owns them.",
            );
          }
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Disallow importing component props types.",
    },
    messages: {
      ruleViolation: "{{message}}",
    },
    schema: [],
    type: "suggestion",
  },
};

const oneComponentPerFileRule: RuleModule = {
  create(context): RuleListener {
    const components: TSESTree.VariableDeclarator[] = [];

    return {
      VariableDeclarator(node): void {
        if (
          node.id.type === AST_NODE_TYPES.Identifier &&
          PASCAL_CASE.test(node.id.name) &&
          node.init?.type === AST_NODE_TYPES.ArrowFunctionExpression
        ) {
          components.push(node);
        }
      },
      "Program:exit"(): void {
        if (components.length <= 1) {
          return;
        }

        for (const component of components.slice(1)) {
          report(
            context,
            component,
            "Prefer one React component per file. Move component-specific subcomponents into a local `components/` folder.",
          );
        }
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Require one React component per file.",
    },
    messages: {
      ruleViolation: "{{message}}",
    },
    schema: [],
    type: "suggestion",
  },
};

export const reactConventionsPlugin: TSESLint.FlatConfig.Plugin = {
  rules: {
    "component-style": componentStyleRule,
    "no-imported-props-types": noImportedPropsTypesRule,
    "one-component-per-file": oneComponentPerFileRule,
  },
};
