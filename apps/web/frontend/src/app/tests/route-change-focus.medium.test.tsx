import {
  Link,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { notFoundHeading } from "../document-title";
import { AppProviders } from "../providers/AppProviders";
import { createAppRouter } from "../routes/app-router";
import { pageTitle, siteText } from "../site-text";
import { RootLayout } from "../views/RootLayout";

/*
 * A route change inside a single-page application replaces main's content
 * while focus stays wherever the activated link was -- which sits in the
 * header or the footer, never inside main -- so a screen-reader user hears
 * nothing arrived (Issue #16 AC-5; CR-006 of Issue #10's review). Moving
 * focus to the new screen's own heading is one of the two answers
 * ui-design.md section 8 leaves open (the other is a live-region
 * announcement); acceptance/pages/accessibility-page.ts's
 * arrivalIsPerceivable accepts either.
 *
 * Rendered through the production route configuration (ADR-0011).
 */
const renderAppAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
};

describe("route-change focus", () => {
  test("the initial render of a screen does not move focus into main", async () => {
    renderAppAt("/privacy");

    const heading = await screen.findByRole("heading", {
      name: /プライバシー/,
      level: 1,
    });

    // Nothing here has any reason to move focus on a direct navigation or a
    // refresh; the browser's own default (the document body) is left alone.
    expect(heading).not.toHaveFocus();
  });

  test("a client-side route change moves focus to the arriving screen's own heading", async () => {
    const user = userEvent.setup();
    renderAppAt("/");

    await screen.findByRole("heading", { name: /Zipnami/, level: 1 });

    await user.click(screen.getByRole("link", { name: siteText.privacyLabel }));

    const heading = await screen.findByRole("heading", {
      name: /プライバシー/,
      level: 1,
    });
    expect(heading).toHaveFocus();

    // TR-001 (test review): the only prior check of a genuine client-side
    // navigation's title update was the slow, cross-browser AT. A useEffect
    // that never ran would still leave this test's own findByRole assertions
    // passing on the old title, so this is checked in the same session as
    // the click above rather than by a separate fresh mount.
    expect(document.title).toBe(pageTitle(siteText.privacyLabel));
  });

  test("a client-side route change to an unknown path moves focus to the not-found heading", async () => {
    // No screen links to a path no route claims, so the navigation itself is
    // driven through the router directly rather than through a rendered
    // <Link> (CR-CODE-002, code review: the not-found destination was
    // untested here even though the client-side-navigation case for
    // /privacy already was). Still a genuine client-side transition, not a
    // fresh load -- router.navigate() is the same call a <Link> click makes.
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ["/"] }),
    );

    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await screen.findByRole("heading", { name: /Zipnami/, level: 1 });

    await router.navigate({ to: "/no-such-route" });

    const heading = await screen.findByRole("heading", {
      name: notFoundHeading,
      level: 1,
    });
    expect(heading).toHaveFocus();
    expect(document.title).toBe(pageTitle(notFoundHeading));
  });

  /*
   * A route can fail to render at all and answer with AppErrorContent
   * instead, which moves focus to its own alert on mount (ui-design.md
   * section 8: focus an error summary only when immediate action is
   * required). Both "/" and "/privacy" below are valid paths on the
   * production router's registered type, so <Link to="/privacy"> still
   * type-checks even though this ad-hoc tree makes that path throw --
   * app-composition.medium.test.tsx's failingRoute() uses the same trick for
   * "/". Guards against the router's generic fallback overriding a screen's
   * own, more specific focus choice.
   */
  const failingDestinationApp = () => {
    const thrownDetail =
      "a route component threw after a client-side navigation";
    const { defaultErrorComponent } = createAppRouter().options;
    const rootRoute = createRootRoute({ component: RootLayout });

    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/",
      component: () => (
        <>
          <h1 tabIndex={-1}>{"Home"}</h1>
          <Link to={"/privacy"}>{"Go to the failing destination"}</Link>
        </>
      ),
    });

    const failingRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/privacy",
      component: () => {
        throw new Error(thrownDetail);
      },
    });

    const routeTree = rootRoute.addChildren([homeRoute, failingRoute]);

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

  test("navigating to a route that fails still leaves focus on its own error summary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(failingDestinationApp());

    const link = await screen.findByRole("link", {
      name: "Go to the failing destination",
    });
    await user.click(link);

    expect(await screen.findByRole("alert")).toHaveFocus();
  });
});
