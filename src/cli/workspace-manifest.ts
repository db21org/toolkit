import type { AppType } from "./bootstrap-options.js";

type WorkspaceManifest = {
  name: string;
  version: string;
  private: boolean;
  type?: string;
  main?: string;
  packageManager?: string;
  engines: Record<string, string>;
  workspaces?: string[];
  resolutions?: Record<string, string>;
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies: Record<string, string>;
};

const appDirectories: Record<AppType, string> = {
  api: "api",
  expo: "app",
  "astro-static": "landing",
  "astro-ssr": "site",
};

const tooling = {
  eslint: "10.8.1",
  typescript: "~6.0.3",
};

export const createAppManifest = (
  type: AppType,
  projectName: string,
  toolkitVersion: string,
): WorkspaceManifest => {
  const common = {
    name: `@${projectName}/${appDirectories[type]}`,
    version: "0.0.0",
    private: true,
    type: "module",
    engines: { node: ">=22.16.0" },
  };
  const devDependencies = { ...tooling, "@types/node": "^22.0.0" };

  if (type === "api") {
    return { ...common, ...createApiSettings(toolkitVersion) };
  }

  if (type === "expo") {
    return { ...common, ...createExpoSettings(toolkitVersion) };
  }

  const ssr = type === "astro-ssr";

  return {
    ...common,
    scripts: {
      check: "astro sync && astro-check",
      lint: "eslint .",
      build: "astro build",
      dev: `astro dev --port ${ssr ? "4322" : "4321"}`,
      preview: "astro preview",
      ...(ssr ? { start: "node dist/server/entry.mjs" } : {}),
    },
    dependencies: {
      astro: "7.0.7",
      ...(ssr ? { "@astrojs/node": "11.0.3" } : {}),
    },
    devDependencies: {
      ...devDependencies,
      "@db21/toolkit": toolkitVersion,
      "@astrojs/check": "0.9.9",
    },
  };
};

export const createRootManifest = (
  projectName: string,
  apps: readonly AppType[],
  toolkitVersion: string,
): WorkspaceManifest => ({
  name: projectName,
  version: "0.0.0",
  private: true,
  type: "module",
  packageManager: "yarn@4.16.0",
  engines: { node: ">=22.16.0" },
  workspaces: ["apps/*"],
  // Match Amatok's checker: newer language servers introduce incompatible native tooling.
  ...(apps.some((app) => app.startsWith("astro"))
    ? { resolutions: { "@astrojs/language-server": "2.16.11" } }
    : {}),
  scripts: {
    build: "turbo run build",
    check: "tsc --noEmit && turbo run check",
    lint: "yarn lint:root && turbo run lint",
    "lint:root": "eslint .",
    "architecture:check": "turbo run architecture:check",
    format: "prettier --write .",
    "format:check": "prettier --check .",
    test: "vitest run",
    ...Object.fromEntries(
      apps.map((app) => [
        `dev:${appDirectories[app]}`,
        `turbo run dev --filter=@${projectName}/${appDirectories[app]}`,
      ]),
    ),
  },
  devDependencies: {
    "@db21/toolkit": toolkitVersion,
    ...tooling,
    "@types/node": "^22.0.0",
    prettier: "^3.9.5",
    ...(apps.some((app) => app.startsWith("astro"))
      ? { "prettier-plugin-astro": "^0.14.1" }
      : {}),
    turbo: "2.10.9",
    vitest: "^4.1.10",
  },
});

export const getAppDirectory = (type: AppType): string => appDirectories[type];

const createApiSettings = (
  toolkitVersion: string,
): Pick<WorkspaceManifest, "scripts" | "dependencies" | "devDependencies"> => ({
  scripts: {
    check: "tsc --noEmit",
    lint: "eslint .",
    build: "tsc -p tsconfig.build.json",
    dev: "tsx watch src/main.ts",
    start: "node dist/main.js",
    "architecture:check":
      "depcruise --config dependency-cruiser.config.mjs src",
  },
  dependencies: {
    "@db21/toolkit": toolkitVersion,
    "@nestjs/common": "11.1.28",
    "@nestjs/core": "11.1.28",
    "@nestjs/platform-express": "11.1.28",
    "reflect-metadata": "0.2.2",
    rxjs: "7.8.2",
  },
  devDependencies: {
    ...tooling,
    "@types/node": "^22.0.0",
    "dependency-cruiser": "18.0.0",
    tsx: "^4.20.6",
  },
});

const createExpoSettings = (
  toolkitVersion: string,
): Pick<
  WorkspaceManifest,
  "main" | "scripts" | "dependencies" | "devDependencies"
> => ({
  main: "expo-router/entry",
  scripts: {
    check: "tsc --noEmit",
    lint: "eslint .",
    build: "expo export --platform web",
    dev: "expo start --web",
    start: "expo start",
    android: "expo start --android",
    ios: "expo start --ios",
    "architecture:check":
      "depcruise --config dependency-cruiser.config.mjs src",
  },
  dependencies: {
    "@db21/toolkit": toolkitVersion,
    "@expo/metro-runtime": "~57.0.3",
    expo: "57.0.7",
    "expo-constants": "~57.0.3",
    "expo-linking": "~57.0.2",
    "expo-router": "57.0.7",
    "expo-status-bar": "~57.0.0",
    react: "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "~0.86.0",
    "react-native-gesture-handler": "~2.32.0",
    "react-native-reanimated": "4.5.0",
    "react-native-worklets": "0.10.0",
    "react-native-safe-area-context": "~5.7.0",
    "react-native-screens": "4.25.2",
    "react-native-web": "^0.21.2",
  },
  devDependencies: {
    ...tooling,
    "@babel/core": "^7.29.0",
    "@react-native/metro-config": "^0.86.0",
    "@types/node": "^22.0.0",
    "@types/react": "~19.2.2",
    "dependency-cruiser": "18.0.0",
  },
});
