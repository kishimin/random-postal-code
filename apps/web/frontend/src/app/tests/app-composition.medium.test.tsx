import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AppProviders } from "../providers/AppProviders";
import { createAppRouter } from "../routes/app-router";
import { App } from "../views/App";

const thrownDetail = "a route component threw while rendering";

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

    // The router catches a failing route before any boundary above it can, so
    // what it falls back to is the screen a visitor gets. Left unset, that is
    // the library's default: "Something went wrong!" in English, unstyled,
    // with a button that reveals the thrown message.
    //
    // Taken from the production router rather than named directly, so removing
    // the option fails here instead of quietly restoring that default.
    const { defaultErrorComponent } = createAppRouter().options;

    const router = createRouter({
      routeTree: createRootRoute({
        component: () => {
          throw new Error(thrownDetail);
        },
      }),
      history: createMemoryHistory({ initialEntries: ["/"] }),
      defaultErrorComponent,
    });

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    expect(
      await screen.findByRole("heading", {
        name: /問題が発生しました/,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(thrownDetail)).not.toBeInTheDocument();
  });
});
