import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { AppErrorContent } from "../views/AppErrorContent";
import { AppErrorView } from "../views/AppErrorView";
import { GeneratorView } from "../views/GeneratorView";
import { NotFoundView } from "../views/NotFoundView";
import { PrivacyView } from "../views/PrivacyView";
import { RootLayout } from "../views/RootLayout";

// notFoundComponent renders inside the root route, so an unknown path keeps the
// header, the footer attribution, and the main landmark the other screens have.
//
// errorComponent is the full screen rather than the content: a failure here is
// RootLayout failing, and the router answers it by replacing the layout. There
// is no frame left to render inside, so this one brings its own.
const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundView,
  errorComponent: AppErrorView,
});

const generatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: GeneratorView,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: PrivacyView,
});

const routeTree = rootRoute.addChildren([generatorRoute, privacyRoute]);

/**
 * Builds the application router from the route tree the application ships.
 *
 * History is injected rather than fixed, so a test can start at a chosen route
 * while still exercising the production configuration. A tree assembled for the
 * test would keep passing after this one broke. The browser history is used
 * when `history` is omitted.
 */
export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    // The router catches a failing route component before any boundary above
    // it can, and its default screen says "Something went wrong!" in English,
    // unstyled, with a button that reveals the thrown message. Without this,
    // the error screen was unreachable from the failure that reaches it most
    // often.
    //
    // The content rather than the full screen: this renders at the failing
    // route's match, inside RootLayout's Outlet, so a version with its own
    // header and footer would show the frame twice.
    defaultErrorComponent: AppErrorContent,
  });

/*
 * Registers the router's type so `<Link to>` is checked against the routes
 * that exist. Without it the library falls back to AnyRouter, `to` degrades to
 * plain string, and a link to a path no route claims compiles.
 *
 * Declared from the factory's return type rather than from a module-scope
 * instance, so the router stays constructed per mount and a test can still
 * inject history.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
