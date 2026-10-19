import type { AbstractNewable } from "inversify";

/** Runtime symbol used as a dependency injection token. */
declare const tokenValue: unique symbol;

/** Typed symbol identifying an injectable dependency. */
export type Token<T> = symbol & { readonly [tokenValue]: T };

/** Class constructor token used for constructor injection. */
export type ClassType<T> = AbstractNewable<T>;

/** DI token as either a branded symbol or a concrete class type. */
export type InjectionToken<T = unknown> = Token<T> | ClassType<T>;

/** Resolves the value represented by a dependency token. */
export type TokenValue<Value extends InjectionToken> =
  Value extends Token<infer Resolved>
    ? Resolved
    : Value extends ClassType<infer Resolved>
      ? Resolved
      : never;

/**
 * Creates a unique token used as a DI key.
 * @param name Human-readable name used in diagnostics.
 * @returns A typed symbol used as a dependency token.
 */
export const token = <T>(name: string): Token<T> => Symbol(name) as Token<T>;

/**
 * Returns a stable diagnostic name for a token.
 * @param value Token to describe.
 * @returns Diagnostic token name.
 */
export const getTokenName = (value: InjectionToken): string =>
  typeof value === "symbol"
    ? (value.description ?? value.toString())
    : value.name;
