import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyInitialDocumentTitle } from "./app/document-title";
import { RootErrorBoundary } from "./app/providers/RootErrorBoundary";
import { createAppRouter } from "./app/routes/app-router";
import { startGoogleAnalytics } from "./app/start-google-analytics";
import { App } from "./app/views/App";
import { AppErrorView } from "./app/views/AppErrorView";
import "./theme/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root is missing from index.html.");
}

/*
 * Closes a race a direct navigation could otherwise expose: the browser's
 * `load` event can fire before this application's asynchronous initial
 * route match commits and the matched screen's own useDocumentTitle call
 * runs, which left index.html's static "Zipnami" title in place long enough
 * for an unpolled read right after navigation to observe it (AC-6 of Issue
 * #16, reliably on WebKit). Setting it here, synchronously and before React
 * ever mounts, means the title is never wrong even for that first instant.
 */
applyInitialDocumentTitle(window.location.pathname);

/*
 * Before React mounts, so the consent defaults are queued ahead of anything
 * the tag could measure. The tag loads asynchronously and nothing waits for
 * it: a blocked or unanswered Analytics request must not delay the render.
 */
startGoogleAnalytics(import.meta.env);

/*
 * A second boundary, outside App rather than inside it.
 *
 * AppProviders holds one too, but it is a descendant of App, so it cannot
 * catch App's own render — and that is where the router is constructed. A
 * failure building the route tree would otherwise leave an empty #root with
 * nothing on screen.
 *
 * The environment is not validated here. vite.config.ts refuses to produce a
 * bundle whose VITE_API_BASE_URL is missing or unusable, so a check at this
 * point could only fail in a bundle that was never built — and it would throw
 * above every boundary, which is the failure it was meant to prevent.
 */
/*
 * Failing to build the router happens before any boundary exists to catch it,
 * and mount() is called with `void`, so the rejection would vanish and leave
 * the prerendered page with a script that never replaced it. Null tells the
 * caller to show the screen the boundary shows.
 */
const buildRouter = () => {
  try {
    return createAppRouter();
  } catch (error) {
    // eslint-disable-next-line no-console -- the only sink this application has
    console.error("Zipnami: the router could not be built.", error);

    return null;
  }
};

const mount = async (container: HTMLElement) => {
  const root = createRoot(container);
  const router = buildRouter();

  if (router === null) {
    root.render(
      <StrictMode>
        <AppErrorView />
      </StrictMode>,
    );

    return;
  }

  /*
   * The page arrives prerendered, and createRoot replaces it. A router that
   * has not matched its route yet renders nothing, so mounting it at once
   * would blank the page until the match committed. Loaded first, the first
   * render already shows the screen the prerendered markup showed. A failed
   * load is the router's to report: it renders its error component.
   */
  await router.load().catch(() => undefined);

  root.render(
    <StrictMode>
      <RootErrorBoundary>
        <App router={router} />
      </RootErrorBoundary>
    </StrictMode>,
  );
};

void mount(rootElement);
