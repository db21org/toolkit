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

const createNestjsRules = (modules) =>
  modules.flatMap((module) => {
    const ruleName = module.directory.replaceAll(/[^a-zA-Z0-9]+/g, "-");
    const entryPoints = [
      "controllers",
      "guards",
      "loaders",
      "pipes",
      "processors",
      "resolvers",
    ];

    return [
      {
        name: `feature-kit-nestjs-${ruleName}-internals-avoid-entry-points`,
        comment:
          "Context, services, repositories, mappers, scalars, types, DTOs, and utilities cannot depend on transport entry points, guards, pipes, processors, or request loaders.",
        severity: "error",
        from: {
          path: rolePath(module, [
            "context",
            "services",
            "repositories",
            "mappers",
            "scalars",
            "types",
            "dto",
            "utils",
          ]),
        },
        to: runtimeRoleTarget(module, entryPoints),
      },
      {
        name: `feature-kit-nestjs-${ruleName}-repositories-avoid-services`,
        comment: "Repositories remain below orchestration services.",
        severity: "error",
        from: { path: rolePath(module, ["repositories"]) },
        to: runtimeRoleTarget(module, ["services"]),
      },
      {
        name: `feature-kit-nestjs-${ruleName}-passive-types-stay-passive`,
        comment:
          "Types, DTOs, and utilities cannot depend on module behavior or entry points.",
        severity: "error",
        from: {
          path: rolePath(module, ["types", "dto", "utils"]),
        },
        to: runtimeRoleTarget(module, [
          "controllers",
          "guards",
          "loaders",
          "resolvers",
          "services",
          "repositories",
          "mappers",
          "pipes",
          "processors",
          "scalars",
        ]),
      },
    ];
  });

export const createNestjsDependencyCruiserConfig = (options) => {
  const coreConfig = createCoreDependencyCruiserConfig(options);
  const modules = discoverFeatureKitModules({
    cwd: options.cwd,
    moduleRoots: options.moduleRoots,
  });

  return {
    ...coreConfig,
    forbidden: [...coreConfig.forbidden, ...createNestjsRules(modules)],
  };
};
