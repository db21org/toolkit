import { assert, isDefined } from "@db21/toolkit/utils";

import {
  type Application,
  inspectModule,
  type ModuleType,
} from "../core/index.js";
import {
  ReactProvider,
  type ReactProviderDependencies,
  type ReactProviderRegistration,
} from "./react-provider.js";
import {
  getSurfaceName,
  getSurfaceResolution,
  isSurface,
  type SurfaceConstructor,
  type SurfaceInstance,
} from "./surface.js";

class ReactRuntimeError extends Error {
  public readonly code: string;

  public constructor(message: string, code: string) {
    super(message);
    this.name = "ReactRuntimeError";
    this.code = code;
  }
}

export type ReactProviderEntry = Readonly<{
  readonly module: ModuleType;
  readonly provider: ReactProvider<ReactProviderDependencies>;
  readonly key: number;
}>;

/**
 * Runtime for composing React providers for a Feature Kit application.
 */
export class ReactRuntime {
  // Cache one runtime per host application so React remount/replay uses stable
  // composition while host-owned disposal remains unchanged.
  private static readonly cache = new WeakMap<Application, ReactRuntime>();

  public readonly entries: readonly ReactProviderEntry[];

  // Cache the exact Promise object per provider dependency set.
  private readonly dependencyCache = new WeakMap<
    ReactProvider<ReactProviderDependencies>,
    Promise<Record<string, unknown>>
  >();

  // Cache the exact construction Promise per Surface/application.
  private readonly surfaceInstanceCache = new WeakMap<
    SurfaceConstructor,
    Promise<SurfaceInstance<SurfaceConstructor>>
  >();
  private readonly synchronousSurfaceInstanceCache = new WeakMap<
    SurfaceConstructor,
    SurfaceInstance<SurfaceConstructor>
  >();

  // Tracks owner module for each discovered Surface registration.
  private readonly surfaceOwnerByType: ReadonlyMap<
    SurfaceConstructor,
    ModuleType
  >;

  /**
   * Creates an isolated runtime for one application.
   * @param application Active Feature Kit application.
   */
  private constructor(private readonly application: Application) {
    const { entries, surfaceOwnerByType } = this.createEntries();

    this.entries = entries;
    this.surfaceOwnerByType = surfaceOwnerByType;
  }

  /**
   * Returns a stable cached runtime instance for the provided application.
   * @param application Runtime application instance.
   * @returns Runtime used to resolve and compose provider entries.
   */
  public static forApplication(application: Application): ReactRuntime {
    application.assertActive();

    const cached = ReactRuntime.cache.get(application);

    if (isDefined(cached)) {
      return cached;
    }

    const runtime = new ReactRuntime(application);

    ReactRuntime.cache.set(application, runtime);

    return runtime;
  }

  /**
   * Resolve all provider dependencies for an entry, preserving Promise identity.
   * @param entry Provider entry to resolve.
   * @returns Resolved dependency map.
   */
  public resolveDependencies(
    entry: ReactProviderEntry,
  ): Promise<Record<string, unknown>> {
    // If unresolved, create a fresh dependency map Promise and cache it by provider
    // registration; React.use() must observe the same Promise instance on replay.
    const cached = this.dependencyCache.get(entry.provider);

    if (isDefined(cached)) {
      return cached;
    }

    const dependencyPairs = Promise.all(
      Object.entries(entry.provider.dependencies).map(async ([name, token]) => {
        assert.defined(
          token,
          "Cannot resolve an untyped React provider dependency.",
        );

        const value = await this.application
          .select(entry.module)
          .resolve(token);

        return [name, value] as const;
      }),
    ).then((pairs) => Object.fromEntries(pairs));

    this.dependencyCache.set(entry.provider, dependencyPairs);

    return dependencyPairs;
  }

  /**
   * Constructs a Surface through the owning module scope.
   *
   * Promise identity is cached so React remounts reuse the same instance.
   *
   * @param surface - Surface constructor to instantiate.
   * @returns A cached construction promise for the Surface instance.
   */
  public instantiateSurface<TSurface extends SurfaceConstructor>(
    surface: TSurface,
  ): Promise<SurfaceInstance<TSurface>> {
    const cached = this.surfaceInstanceCache.get(surface);

    if (isDefined(cached)) {
      return cached;
    }

    const owner = this.surfaceOwnerByType.get(surface);

    assert.defined(
      owner,
      new ReactRuntimeError(
        `Surface "${getSurfaceName(surface)}" is not registered for this application.`,
        "surface_not_registered",
      ),
    );

    const instance = this.application
      .select(owner)
      .instantiate(surface) as Promise<SurfaceInstance<TSurface>>;

    this.surfaceInstanceCache.set(surface, instance);

    return instance;
  }

  /**
   * Constructs an explicitly synchronous Surface through its owning module.
   *
   * @param surface - Synchronous Surface constructor to instantiate.
   * @returns A cached Surface instance.
   */
  public instantiateSurfaceSync<TSurface extends SurfaceConstructor>(
    surface: TSurface,
  ): SurfaceInstance<TSurface> {
    assert.true(
      getSurfaceResolution(surface) === "sync",
      `Surface "${getSurfaceName(surface)}" is not configured for synchronous resolution.`,
    );

    const cached = this.synchronousSurfaceInstanceCache.get(surface);

    if (isDefined(cached)) {
      return cached;
    }

    const owner = this.surfaceOwnerByType.get(surface);

    assert.defined(
      owner,
      new ReactRuntimeError(
        `Surface "${getSurfaceName(surface)}" is not registered for this application.`,
        "surface_not_registered",
      ),
    );

    const instance = this.application
      .select(owner)
      .instantiateSync(surface) as SurfaceInstance<TSurface>;

    this.synchronousSurfaceInstanceCache.set(surface, instance);

    return instance;
  }

  // eslint-disable-next-line max-lines-per-function -- keep declaration-order validation and metadata collection in one pass for deterministic behavior
  private createEntries(): Readonly<{
    readonly entries: readonly ReactProviderEntry[];
    readonly surfaceOwnerByType: ReadonlyMap<SurfaceConstructor, ModuleType>;
  }> {
    // Modules are visited dependency-first; preserve declaration order within each
    // module so provider composition is deterministic and stable.
    const modules = this.application.modules;
    const entries: ReactProviderEntry[] = [];
    const owners = new Map<ReactProviderRegistration, ModuleType>();
    const surfaceOwners = new Map<SurfaceConstructor, ModuleType>();
    let nextProviderKey = 0;

    for (const module of modules) {
      const metadata = inspectModule(module);

      assert.defined(
        metadata,
        new ReactRuntimeError(
          `Module "${module.name}" is missing @Module metadata.`,
          "module_not_decorated",
        ),
      );

      const reactProviders = metadata.reactProviders ?? [];

      assert.true(
        Array.isArray(reactProviders),
        `${module.name}.reactProviders must be an array of registrations.`,
      );

      for (const candidate of reactProviders) {
        // Marker interfaces are erased, so the concrete class check is the runtime
        // guard that filters out structurally-shaped non-ReactProvider objects.
        assert.true(
          candidate instanceof ReactProvider,
          new ReactRuntimeError(
            `Module "${module.name}" has an invalid react provider registration.`,
            "invalid_react_provider",
          ),
        );

        const provider = candidate as ReactProvider<ReactProviderDependencies>;
        const existingOwner = owners.get(candidate);

        // Same provider instance cannot belong to multiple owner modules.
        assert.notDefined(
          existingOwner,
          new ReactRuntimeError(
            `React provider "${provider.name}" has multiple owners.`,
            "duplicate_react_provider_owner",
          ),
        );

        owners.set(candidate, module);

        entries.push(
          Object.freeze({
            module,
            provider,
            key: nextProviderKey,
          }),
        );

        nextProviderKey += 1;
      }

      const surfaces = metadata.surfaces ?? [];

      assert.true(
        Array.isArray(surfaces),
        `${module.name}.surfaces must be an array of surface registrations.`,
      );

      for (const candidate of surfaces) {
        assert.true(
          isSurface(candidate),
          new ReactRuntimeError(
            `Module "${module.name}" has an invalid surface registration.`,
            "invalid_surface",
          ),
        );
        assert.false(
          getSurfaceResolution(candidate) === "direct",
          new ReactRuntimeError(
            `Direct Surface "${getSurfaceName(candidate)}" must not be registered in module metadata.`,
            "direct_surface_registered",
          ),
        );

        const existingOwner = surfaceOwners.get(candidate);

        assert.notDefined(
          existingOwner,
          new ReactRuntimeError(
            `Surface "${getSurfaceName(candidate)}" has multiple owners.`,
            "duplicate_surface_owner",
          ),
        );

        surfaceOwners.set(candidate, module);
      }
    }

    return {
      entries: Object.freeze(entries),
      surfaceOwnerByType: surfaceOwners,
    };
  }
}
