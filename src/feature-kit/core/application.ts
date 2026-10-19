import { assert, isDefined, isNotEmpty } from "@db21/toolkit/utils";
import { PluginDispose } from "@inversifyjs/plugin-dispose";
import { Container, ContainerModule } from "inversify";

import {
  createDisposalFailedError,
  createDisposedApplicationError,
  createDisposedTokenError,
  createModuleExportNotOwnedError,
  createModuleImportCycleError,
  createModuleNotRegisteredError,
  createUndecoratedModuleError,
} from "./errors.js";
import {
  inspectModule,
  type ModuleMetadata,
  type ModuleType,
} from "./modules.js";
import { type ClassType, getTokenName, type InjectionToken } from "./tokens.js";

const defineDisposalSymbol = (name: "asyncDispose" | "dispose"): void => {
  if (typeof Symbol[name] !== "symbol") {
    Object.defineProperty(Symbol, name, {
      value: Symbol(`Symbol.${name}`),
    });
  }
};

// Inversify's disposal plugin requires explicit-resource-management symbols,
// which are not available in every supported WebKit runtime.
defineDisposalSymbol("dispose");
defineDisposalSymbol("asyncDispose");

type DisposedContainer = {
  [Symbol.asyncDispose]: () => Promise<void>;
};

type ModuleRuntime = Readonly<{
  readonly moduleType: ModuleType;
  readonly metadata: ModuleMetadata;
  readonly container: Container & DisposedContainer;
  readonly exports: ReadonlySet<InjectionToken>;
}>;

export type ModuleContext = Readonly<{
  resolve<T>(token: InjectionToken<T>): Promise<T>;
  instantiate<T>(type: ClassType<T>): Promise<T>;
  instantiateSync<T>(type: ClassType<T>): T;
}>;

/** Runtime Feature Kit application facade. */
export class Application {
  private readonly rootModule: ModuleType;
  private readonly moduleRuntimes: readonly ModuleRuntime[];
  private readonly moduleRuntimeByModule: ReadonlyMap<
    ModuleType,
    ModuleRuntime
  >;
  private readonly orderedModules: readonly ModuleType[];
  private readonly selectedModuleContexts: WeakMap<ModuleType, ModuleContext> =
    new WeakMap<ModuleType, ModuleContext>();
  private disposePromise: Promise<void> | undefined = undefined;

  private constructor(rootModule: ModuleType) {
    const { moduleRuntimes, moduleRuntimeByModule, orderedModules } =
      Application.createModuleRuntimes(rootModule);

    this.rootModule = rootModule;
    this.moduleRuntimes = moduleRuntimes;
    this.moduleRuntimeByModule = moduleRuntimeByModule;
    this.orderedModules = orderedModules;
  }

  /**
   * Creates and wires a Feature Kit application for the decorated module graph.
   * @param rootModule Root module descriptor.
   * @returns Runtime application facade.
   */
  public static create(rootModule: ModuleType): Application {
    return new Application(rootModule);
  }

  /**
   * Dependency-first immutable module list.
   * @returns Dependency-first list of modules registered in this application.
   * @throws {FeatureKitError} when the application has started disposal.
   */
  public get modules(): readonly ModuleType[] {
    this.assertActive();

    return this.orderedModules;
  }

  /**
   * Resolves a token from the root module runtime.
   * @param token Resolution token.
   * @returns Promise resolving the requested token.
   */
  public resolve<T>(token: InjectionToken<T>): Promise<T> {
    const rootRuntime = this.getModuleRuntime(this.rootModule);

    return this.resolveFromRuntime(rootRuntime, token);
  }

  /**
   * Selects a registered module runtime context.
   * @param ownerModule Module to own the resolution scope.
   * @returns Module-scoped resolver.
   */
  public select(ownerModule: ModuleType): ModuleContext {
    this.assertActive();

    const cached = this.selectedModuleContexts.get(ownerModule);

    if (isDefined(cached)) {
      return cached;
    }

    const ownerRuntime = this.getModuleRuntime(ownerModule);
    const moduleContext = this.createModuleContext(ownerRuntime);

    this.selectedModuleContexts.set(ownerModule, moduleContext);

    return moduleContext;
  }

  /**
   * Disposes all owned singletons.
   * @returns Promise resolving once disposal completes.
   */
  public dispose(): Promise<void> {
    if (isDefined(this.disposePromise)) {
      return this.disposePromise;
    }

    this.disposePromise = (async (): Promise<void> => {
      // TODO(tech-debt): Attempt every module disposal, then report collected
      // failures instead of leaking remaining containers.
      // Dispose in reverse graph order so dependents are torn down before imports.
      for (const moduleRuntime of [...this.moduleRuntimes].toReversed()) {
        try {
          await moduleRuntime.container[Symbol.asyncDispose]();
        } catch (cause: unknown) {
          // Fail fast on first disposal error and wrap as an application disposal failure.
          throw createDisposalFailedError(cause);
        }
      }
    })();

    return this.disposePromise;
  }

  /**
   * Ensures this application is still active for external callers.
   * @throws {FeatureKitError} when disposal has already started.
   */
  public assertActive(): void {
    assert.notDefined(this.disposePromise, createDisposedApplicationError());
  }

  private assertTokenActive<T>(token: InjectionToken<T>): void {
    assert.notDefined(this.disposePromise, createDisposedTokenError(token));
  }

  private getModuleRuntime(ownerModule: ModuleType): ModuleRuntime {
    const moduleRuntime = this.moduleRuntimeByModule.get(ownerModule);

    assert.defined(moduleRuntime, createModuleNotRegisteredError(ownerModule));

    return moduleRuntime;
  }

  private resolveFromRuntime<T>(
    moduleRuntime: ModuleRuntime,
    token: InjectionToken<T>,
  ): Promise<T> {
    this.assertTokenActive(token);

    const resolution = moduleRuntime.container.getAsync<T>(token);

    return (async (): Promise<T> => {
      try {
        const resolvedValue = await resolution;

        // Confirm disposal did not begin while awaiting async dependency construction.
        this.assertTokenActive(token);

        return resolvedValue;
      } catch (cause: unknown) {
        this.assertTokenActive(token);

        throw cause;
      }
    })();
  }

  private createModuleContext(moduleRuntime: ModuleRuntime): ModuleContext {
    return Object.freeze({
      resolve: <T>(token: InjectionToken<T>): Promise<T> => {
        return this.resolveFromRuntime(moduleRuntime, token);
      },
      instantiate: <T>(type: ClassType<T>): Promise<T> => {
        this.assertTokenActive(type);

        if (!moduleRuntime.container.isBound(type)) {
          moduleRuntime.container.bind(type).toSelf().inTransientScope();
        }

        const construction = moduleRuntime.container.getAsync(type);

        return (async (): Promise<T> => {
          try {
            const resolvedValue = await construction;

            this.assertTokenActive(type);

            return resolvedValue;
          } catch (cause: unknown) {
            this.assertTokenActive(type);

            throw cause;
          }
        })();
      },
      instantiateSync: <T>(type: ClassType<T>): T => {
        this.assertTokenActive(type);

        if (!moduleRuntime.container.isBound(type)) {
          moduleRuntime.container.bind(type).toSelf().inTransientScope();
        }

        const instance = moduleRuntime.container.get(type);

        this.assertTokenActive(type);

        return instance;
      },
    });
  }

  private static createModuleRuntimes(rootModule: ModuleType): {
    readonly moduleRuntimes: readonly ModuleRuntime[];
    readonly moduleRuntimeByModule: ReadonlyMap<ModuleType, ModuleRuntime>;
    readonly orderedModules: readonly ModuleType[];
  } {
    const orderedModules = this.collectModules(rootModule);
    const runtimeByModule = new Map<ModuleType, ModuleRuntime>();

    // Create every module container first so imports can always resolve from a complete map.
    for (const moduleType of orderedModules) {
      const metadata = this.inspectModuleMetadata(moduleType);
      const moduleRuntime = this.createModuleRuntime(moduleType, metadata);

      runtimeByModule.set(moduleType, moduleRuntime);
    }

    for (const moduleRuntime of runtimeByModule.values()) {
      for (const importedModule of moduleRuntime.metadata.imports ?? []) {
        const importedRuntime = runtimeByModule.get(importedModule);

        assert.defined(
          importedRuntime,
          createUndecoratedModuleError(importedModule),
        );

        // Forward only the imported module's declared exports with transient bindings.
        for (const exportToken of importedRuntime.exports) {
          moduleRuntime.container
            .bind(exportToken)
            .toDynamicValue(() =>
              importedRuntime.container.getAsync(exportToken),
            )
            .inTransientScope();
        }
      }
    }

    const rootRuntime = runtimeByModule.get(rootModule);

    assert.defined(rootRuntime, createUndecoratedModuleError(rootModule));

    return {
      moduleRuntimes: [...runtimeByModule.values()],
      moduleRuntimeByModule: runtimeByModule,
      orderedModules: Object.freeze([...orderedModules]),
    };
  }

  private static collectModules(rootModule: ModuleType): readonly ModuleType[] {
    const orderedModules: ModuleType[] = [];
    const visitedModules = new Set<ModuleType>();

    const visit = (
      moduleType: ModuleType,
      modulePath: readonly ModuleType[],
    ): void => {
      // Memoize traversal so shared modules are registered once; module providers remain lazy.
      if (visitedModules.has(moduleType)) {
        return;
      }

      const metadata = this.inspectModuleMetadata(moduleType);
      const cycleIndex = modulePath.indexOf(moduleType);

      // Validate import cycles by checking the active DFS stack.
      assert.false(
        cycleIndex >= 0,
        createModuleImportCycleError(
          cycleIndex >= 0
            ? [...modulePath.slice(cycleIndex), moduleType].map((moduleType) =>
                this.getModuleName(moduleType),
              )
            : [],
        ),
      );

      const dependencyPath = [...modulePath, moduleType];

      for (const dependency of metadata.imports ?? []) {
        visit(dependency, dependencyPath);
      }

      // Register modules deterministically via DFS: dependencies are added before dependents,
      // so disposal can later run in reverse order.
      visitedModules.add(moduleType);
      orderedModules.push(moduleType);
    };

    visit(rootModule, []);

    return orderedModules;
  }

  private static createModuleRuntime(
    moduleType: ModuleType,
    metadata: ModuleMetadata,
  ): ModuleRuntime {
    // Each module gets an isolated container plus dispose support for its own singletons.
    const container = new Container() as Container & DisposedContainer;

    container.register(PluginDispose);

    const ownedBindings = new Set<InjectionToken>();
    const moduleContainer = new ContainerModule((loadContext) => {
      metadata.configure?.({
        // Track every binding registered by the module configure callback.
        bind: (serviceIdentifier) => {
          const dependencyToken = serviceIdentifier as InjectionToken;

          ownedBindings.add(dependencyToken);

          return loadContext.bind(serviceIdentifier);
        },
        onDeactivation: loadContext.onDeactivation,
      });
    });

    container.load(moduleContainer);

    const exports = new Set<InjectionToken>(metadata.exports ?? []);

    // Fail fast if a module exports a token it does not own.
    for (const exportToken of exports) {
      assert.true(
        ownedBindings.has(exportToken),
        createModuleExportNotOwnedError(moduleType, exportToken),
      );
    }

    return {
      moduleType,
      metadata,
      container,
      exports,
    };
  }

  private static inspectModuleMetadata(moduleType: ModuleType): ModuleMetadata {
    const metadata = inspectModule(moduleType);

    assert.defined(metadata, createUndecoratedModuleError(moduleType));

    return metadata;
  }

  private static getModuleName(moduleType: ModuleType): string {
    return isNotEmpty(moduleType.name)
      ? moduleType.name
      : getTokenName(moduleType);
  }
}
