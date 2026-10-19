# @db21/toolkit/feature-kit/conventions

Static module conventions for Feature Kit-style TypeScript applications. These subpaths do not load the Feature Kit runtime.

Profiles:

- `core` — module discovery, explicit public APIs, role filenames, isolation, and one-way shared folders;
- `react` — core plus query, hook, surface, and react-provider role filenames plus the data/render dependency direction;
- `nestjs` — core plus NestJS role filenames and entry-point dependency direction.

Each consumer owns its ESLint and dependency-cruiser installations and imports only the profile it uses. The React profile recognizes:

- application context registrations under `react-providers/name.react-provider.tsx`, and
- Surface render targets under `surfaces/Name.surface.tsx`.

`@Surface()` class decorators are constrained to `surfaces/*.surface.tsx` files, and Surface files are kept free of navigation/platform/react-provider/query/hook rendering dependencies.

```js
import { createReactEslintConfig } from "@db21/toolkit/feature-kit/conventions/react/eslint";
import { createReactDependencyCruiserConfig } from "@db21/toolkit/feature-kit/conventions/react/dependency-cruiser";
```

The `react` profile now uses first-class Surface conventions and removes the legacy `presenters`, `presentations`, and `views` layering.

NestJS applications use the equivalent `nestjs/eslint` and `nestjs/dependency-cruiser` exports. The NestJS profile recognizes clients, contracts, controllers, request-scoped loaders, resolvers, services, repositories, providers, models, schemas, and DTOs while keeping transport entry points and loaders out of internal layers. GraphQL `@InputType` classes must live under `dto/` and use `name.input.dto.ts`; GraphQL `@ObjectType` classes must use `name.output.dto.ts`, and framework-free external payload shapes use `contracts/*.contract.ts`.
