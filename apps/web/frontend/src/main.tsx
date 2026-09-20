import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RootErrorBoundary } from "./app/providers/RootErrorBoundary";
import { App } from "./app/views/App";
import "./theme/globals.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root is missing from index.html.");
}

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
createRoot(rootElement).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
