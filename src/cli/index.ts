#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { cancel, isCancel, multiselect, outro, text } from "@clack/prompts";
import { defineCommand, runMain } from "citty";

import { assert, isDefined } from "../utils/index.js";
import { bootstrap } from "./bootstrap.js";
import { appTypes } from "./bootstrap-options.js";

const manifestText = await readFile(
  new URL("../../package.json", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(manifestText) as { version: string };

const command = defineCommand({
  meta: {
    name: "toolkit",
    version: manifest.version,
    description: "db21 development helpers",
  },
  subCommands: {
    graph: defineCommand({
      meta: {
        description:
          "Explore a SPARQL endpoint in a local read-only SVG viewer",
      },
      args: {
        endpoint: {
          type: "positional",
          description: "SPARQL query endpoint URL",
          required: true,
        },
        port: {
          type: "string",
          description: "Local HTTP port",
          default: "4319",
        },
        graph: { type: "string", description: "Optional named graph IRI" },
      },
      async run({ args }) {
        const { startGraphServer } = await import("./graph/server.js");

        await startGraphServer({
          endpoint: args.endpoint,
          port: Number(args.port),
          ...(isDefined(args.graph) ? { graph: args.graph } : {}),
        });
      },
    }),
    bootstrap: defineCommand({
      meta: {
        description: "Create a toolkit workspace from Amatok-derived starters",
      },
      args: {
        directory: {
          type: "positional",
          description: "New or empty destination",
          required: false,
        },
        name: {
          type: "string",
          description: "Project name (lowercase kebab-case)",
        },
        apps: {
          type: "string",
          description: `Comma-separated app types: ${appTypes.join(", ")}`,
        },
      },
      async run({ args }) {
        const interactive = process.stdin.isTTY && process.stdout.isTTY;

        assert.true(
          interactive || (isDefined(args.directory) && isDefined(args.apps)),
          "Non-interactive usage requires a directory and --apps.",
        );

        const directory =
          args.directory ??
          (await text({
            message: "Destination directory",
            placeholder: "my-project",
          }));

        if (isCancel(directory)) {
          cancel("Bootstrap cancelled. No files changed.");

          return;
        }

        const selected = isDefined(args.apps)
          ? args.apps.split(",").map((app) => app.trim())
          : await multiselect({
              message: "Select app types",
              options: [
                { value: "api", label: "NestJS API" },
                { value: "expo", label: "Expo app (web/iOS/Android)" },
                { value: "astro-static", label: "Astro static site" },
                { value: "astro-ssr", label: "Astro SSR site" },
              ],
              required: true,
            });

        if (isCancel(selected)) {
          cancel("Bootstrap cancelled. No files changed.");

          return;
        }

        const destination = await bootstrap(
          {
            directory,
            apps: selected,
            ...(isDefined(args.name) ? { name: args.name } : {}),
          },
          manifest.version,
        );

        outro(
          `Created ${destination}. Next: cd ${JSON.stringify(destination)}, corepack yarn install, corepack yarn format. See README.md.`,
        );
      },
    }),
  },
});

await runMain(command);
