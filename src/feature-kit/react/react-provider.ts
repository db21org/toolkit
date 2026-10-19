import { assert, isNotEmpty } from "@db21/toolkit/utils";
import type React from "react";

import { type InjectionToken, type TokenValue } from "../core/index.js";

export type ReactProviderDependencies = Readonly<
  Record<string, InjectionToken>
>;

export type ReactProviderProps<Dependencies extends ReactProviderDependencies> =
  Readonly<
    {
      readonly children: React.ReactNode;
    } & {
      [Key in keyof Dependencies]: TokenValue<Dependencies[Key]>;
    }
  >;

export type ReactProviderOptions<
  Dependencies extends ReactProviderDependencies,
> = Readonly<{
  /** React renderer for the provider component. */
  readonly component: React.ComponentType<ReactProviderProps<Dependencies>>;
  /** Module-owned module dependencies for this provider render. */
  readonly dependencies: Dependencies;
}>;

// Instance markers erase `ReactProvider` generic variance in module metadata typing,
// while runtime uses `instanceof ReactProvider` to restore concrete class certainty.
const reactProviderKind = Symbol("feature-kit-react-provider");
const anonymousReactProviderName = "AnonymousReactProvider";

export type ReactProviderRegistration = {
  readonly [reactProviderKind]: true;
};

/**
 * Describes a module-scoped React provider registration.
 */
export class ReactProvider<
  Dependencies extends ReactProviderDependencies,
> implements ReactProviderRegistration {
  public readonly [reactProviderKind] = true as const;

  /** React renderer for the provider component. */
  public readonly component: React.ComponentType<
    ReactProviderProps<Dependencies>
  >;
  /** Module-owned module dependencies for this provider render. */
  public readonly dependencies: Dependencies;

  /**
   * Creates a typed provider registration.
   * @param options Registration options.
   */
  public constructor(options: ReactProviderOptions<Dependencies>) {
    assert.defined(
      options.component,
      "Cannot register a React provider without a component.",
    );

    this.component = options.component;
    this.dependencies = options.dependencies;

    Object.freeze(this);
  }

  /**
   * Provider name resolved from displayName then function/class name.
   * @returns Display name or fallback provider name.
   */
  public get name(): string {
    const displayName = this.component.displayName ?? "";

    if (isNotEmpty(displayName)) {
      return displayName;
    }

    return isNotEmpty(this.component.name)
      ? this.component.name
      : anonymousReactProviderName;
  }
}

/**
 * Defines a module-scoped React provider registration.
 * @param options Registration definition.
 * @returns A typed React provider instance.
 */
export const reactProvider = <
  const Dependencies extends ReactProviderDependencies,
>(
  options: ReactProviderOptions<Dependencies>,
): ReactProvider<Dependencies> => {
  return new ReactProvider(options);
};
