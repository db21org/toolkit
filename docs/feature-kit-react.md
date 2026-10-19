# @db21/toolkit/feature-kit/react

Feature Kit integration for React 19 using Suspense-based provider composition and
first-class Surface rendering.

## React providers

Compose module-owned React providers through `reactProvider` and wrap your app with
`FeatureKitProvider`.

```tsx
import { createContext, type ReactNode } from "react";
import {
  Application,
  Module,
  token,
} from "@db21/toolkit/feature-kit";
import { FeatureKitProvider, reactProvider } from "@db21/toolkit/feature-kit/react";

type Theme = Record<string, unknown>;

const Theme = token<Theme>("Theme");
const ThemeContext = createContext<Theme | undefined>(undefined);

const ThemeContextProvider = ({
  children,
  theme,
}: {
  children: ReactNode;
  theme: Theme;
}) => <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;

@Module({
  imports: [...],
  reactProviders: [
    reactProvider({
      component: ThemeContextProvider,
      dependencies: {
        theme: Theme,
      },
    }),
  ],
})
class AppModule {}

const app = Application.create(AppModule);

export const App = () => (
  <FeatureKitProvider application={app} fallback={<p>Loading…</p>}>
    <MainRoutes />
  </FeatureKitProvider>
);
```

## Surfaces

Use `@Surface()` to define class-based render targets that receive exactly one
`render` argument and can inject dependencies through Feature Kit constructors.

```tsx
import { Application, Module } from "@db21/toolkit/feature-kit";
import {
  FeatureKitProvider,
  RenderSurface,
  Surface,
  type EmptySurfaceProps,
} from "@db21/toolkit/feature-kit/react";

@Surface()
class FeedSurface {
  public render(_props: EmptySurfaceProps): React.ReactElement | null {
    return <p>Feed Surface</p>;
  }
}

@Surface()
class ProductSurface {
  public render({
    productId,
  }: {
    productId: string;
  }): React.ReactElement | null {
    return <p>Product {productId}</p>;
  }
}

@Module({
  surfaces: [FeedSurface, ProductSurface],
})
class FeedModule {}

const app = Application.create(FeedModule);

export const FeedRoute = () => (
  <FeatureKitProvider application={app}>
    <RenderSurface surface={FeedSurface} />
    <RenderSurface surface={ProductSurface} props={{ productId: "sku-001" }} />
  </FeatureKitProvider>
);
```

## Surface lifecycle and rendering

- `Surface` classes are instantiated lazily through their owning Feature Kit module
  context.
- Surface instances are cached per application and Surface class, so remounting the
  component reuses the same construction promise.
- Surface instances are intended to be stateless wiring objects; any mutable UI
  state or effects should be represented in the rendered React components, not on the
  Surface instance itself.
- `Surface.render()` is not a React component and must not call hooks directly.
  Delegate hook usage and mutable UI state to smart/dumb React components returned
  from `render()`.
- `RenderSurface` throws a runtime error when used outside
  `FeatureKitProvider`.
