import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";

const {
  BUILD_COMPONENTS: componentsJson,
  BUILD_WORKSPACE_COMPONENTS: workspaceJson,
  BUILD_CHANGES: changesJson,
  BUILD_COMPONENT: component,
  BUILD_WORKSPACE_GRAPH_CHANGED: workspaceChanged,
  GITHUB_EVENT_NAME: event,
  GITHUB_OUTPUT: output,
} = process.env;
const supported = JSON.parse(componentsJson ?? "null");
const workspace = JSON.parse(workspaceJson ?? "null");
const changes = JSON.parse(changesJson ?? "null");

assert(
  Array.isArray(supported) &&
    supported.every(
      (value) =>
        typeof value === "string" && /^[a-z][a-z\d-]{0,62}$/u.test(value),
    ) &&
    new Set(supported).size === supported.length,
  "Invalid supported components.",
);
assert(
  Array.isArray(workspace) &&
    workspace.every((value) => supported.includes(value)),
  "Invalid workspace components.",
);
assert(
  Array.isArray(changes) &&
    changes.every(
      (value) => value === "workspace_graph" || supported.includes(value),
    ),
  "Invalid changed components.",
);
assert(
  event === "push" || event === "workflow_dispatch",
  "Unsupported build planning event.",
);
assert(
  workspaceChanged === "true" || workspaceChanged === "false",
  "Invalid workspace graph flag.",
);
assert(output, "Expected GitHub output path.");

let components;

if (event === "workflow_dispatch") {
  assert(
    component === "all" || supported.includes(component),
    "Unsupported component.",
  );
  components = component === "all" ? supported : [component];
} else {
  const changedComponents = changes.filter(
    (value) => value !== "workspace_graph",
  );

  components =
    workspaceChanged === "true"
      ? [...new Set([...workspace, ...changedComponents])].toSorted(
          (left, right) => left.localeCompare(right),
        )
      : [...new Set(changedComponents)];
}

appendFileSync(output, `components=${JSON.stringify(components)}\n`);
