import type { IConfiguration } from "dependency-cruiser";

export type DiscoveredFeatureKitModule = Readonly<{
  directory: string;
  moduleFile: string;
}>;

export type ModuleDiscoveryOptions = Readonly<{
  cwd?: string;
  moduleRoots: readonly string[];
}>;

export type CoreDependencyCruiserOptions = ModuleDiscoveryOptions &
  Readonly<{
    allow?: readonly string[];
    exclude?: readonly string[];
    sourceRoot: string;
    tsConfig?: string;
  }>;

export declare const createCoreDependencyCruiserConfig: (
  options: CoreDependencyCruiserOptions,
) => IConfiguration;

export declare const discoverFeatureKitModules: (
  options: ModuleDiscoveryOptions,
) => readonly DiscoveredFeatureKitModule[];

export declare const coreDependencyCruiserRules: IConfiguration["forbidden"];
