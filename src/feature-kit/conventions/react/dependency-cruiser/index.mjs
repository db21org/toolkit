import {
  createCoreDependencyCruiserConfig,
  discoverFeatureKitModules,
} from "../../core/dependency-cruiser/index.mjs";

const escapeRegularExpression = (value) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

const rolePath = (module, roles) =>
  `^${escapeRegularExpression(module.directory)}/(?:${roles.join("|")})/`;

const runtimeRoleTarget = (module, roles) => ({
  path: rolePath(module, roles),
  preCompilationOnly: false,
});

const createReactRules = (modules) =>
  modules.flatMap((module) => {
    const ruleName = module.directory.replaceAll(/[^a-zA-Z0-9]+/g, "-");

    return [
      {
        name: `feature-kit-react-${ruleName}-services-avoid-ui`,
        comment:
          "Services remain independent from query hooks, render wiring, and feature UI.",
        severity: "error",
        from: { path: rolePath(module, ["services"]) },
        to: runtimeRoleTarget(module, [
          "queries",
          "hooks",
          "surfaces",
          "components",
          "react-providers",
        ]),
      },
      {
        name: `feature-kit-react-${ruleName}-queries-stay-data-only`,
        comment:
          "Queries may use services but should not depend on UI wiring, render layers, or platform providers.",
        severity: "error",
        from: { path: rolePath(module, ["queries"]) },
        to: runtimeRoleTarget(module, [
          "hooks",
          "surfaces",
          "components",
          "react-providers",
        ]),
      },
      {
        name: `feature-kit-react-${ruleName}-hooks-stay-ui-only`,
        comment:
          "UI hooks receive data/callback props from callers and should not resolve data-layer or render wiring directly.",
        severity: "error",
        from: { path: rolePath(module, ["hooks"]) },
        to: runtimeRoleTarget(module, [
          "services",
          "queries",
          "surfaces",
          "react-providers",
        ]),
      },
      {
        name: `feature-kit-react-${ruleName}-surfaces-keep-render-wiring`,
        comment:
          "Surface classes are DI/render wiring objects and must not depend on query hooks, query modules, or React provider modules.",
        severity: "error",
        from: { path: rolePath(module, ["surfaces"]) },
        to: runtimeRoleTarget(module, ["hooks", "queries", "react-providers"]),
      },
      {
        name: `feature-kit-react-${ruleName}-react-providers-stay-integration-only`,
        comment:
          "React providers adapt initialized services to app context without depending on feature UI or render wiring.",
        severity: "error",
        from: { path: rolePath(module, ["react-providers"]) },
        to: runtimeRoleTarget(module, [
          "hooks",
          "queries",
          "surfaces",
          "components",
        ]),
      },
    ];
  });

export const createReactDependencyCruiserConfig = (options) => {
  const coreConfig = createCoreDependencyCruiserConfig(options);
  const modules = discoverFeatureKitModules({
    cwd: options.cwd,
    moduleRoots: options.moduleRoots,
  });

  return {
    ...coreConfig,
    forbidden: [...coreConfig.forbidden, ...createReactRules(modules)],
  };
};
