import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { GeneratorView } from "../views/GeneratorView";
import { NotFoundView } from "../views/NotFoundView";
import { PrivacyView } from "../views/PrivacyView";
import { RootLayout } from "../views/RootLayout";

// notFoundComponent renders inside the root route, so an unknown path keeps the
// header, the footer attribution, and the main landmark the other screens have.
const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundView,
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
  createRouter({ routeTree, history });
