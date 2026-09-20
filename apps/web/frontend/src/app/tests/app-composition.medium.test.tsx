import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AppProviders } from "../providers/AppProviders";
import { createAppRouter } from "../routes/app-router";
import { App } from "../views/App";
import { RootLayout } from "../views/RootLayout";

const thrownDetail = "a route component threw while rendering";

/*
 * A child route that throws, under the production frame and the production
 * fallback.
 *
 * The root route carries RootLayout, as it does in the application, because
 * the fallback renders at the failing route's match rather than in place of
 * the whole tree. A root route that throws would skip the frame entirely and
 * hide what that nesting does.
 *
 * defaultErrorComponent is read off the production router rather than named
 * directly, so removing the option fails here instead of quietly restoring the
 * library's own screen — "Something went wrong!" in English, unstyled, with a
 * button that reveals the thrown message.
 */
const failingRoute = () => {
  const { defaultErrorComponent } = createAppRouter().options;
  const rootRoute = createRootRoute({ component: RootLayout });

  const routeTree = rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => {
        throw new Error(thrownDetail);
      },
    }),
  ]);

  return (
    <AppProviders>
      <RouterProvider
        router={createRouter({
          routeTree,
          history: createMemoryHistory({ initialEntries: ["/"] }),
          defaultErrorComponent,
        })}
      />
    </AppProviders>
  );
};

/*
 * Holds the composition itself, which no other test renders.
 *
 * root-error-boundary renders AppProviders around a throwing child, and
 * routing renders a RouterProvider on its own. Neither passes through App, so
 * a failure that starts inside a route — the way failures actually start —
 * went unexercised, and the screen it reached was not the one this application
 * ships.
 */
describe("application composition", () => {
  test("the application mounts the production router", async () => {
    // App builds its router from browser history, which is what production
    // does. The test page is served from another path, so without this the
    // router resolves the not-found screen.
    window.history.pushState({}, "", "/");

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /Zipnami/, level: 1 }),
    ).toBeInTheDocument();
  });

  test("a failing route reaches the global error screen, not the router's own", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(failingRoute());

    expect(
      await screen.findByRole("heading", {
        name: /問題が発生しました/,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(thrownDetail)).not.toBeInTheDocument();
  });

  test("the failing route replaces the page content, not the frame around it", async () => {
    // The router renders its fallback at the failing route's own match, so
    // RootLayout stays mounted around it. A fallback that carried its own
    // header and footer would nest a second main landmark inside the first and
    // show the visitor two of everything.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(failingRoute());

    await screen.findByRole("heading", {
      name: /問題が発生しました/,
      level: 1,
    });

    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
  });
});
