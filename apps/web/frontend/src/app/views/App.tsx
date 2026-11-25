import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { AppProviders } from "../providers/AppProviders";
import { createAppRouter } from "../routes/app-router";

type AppProps = {
  /**
   * A router that has already matched its first route. Mounting an unloaded
   * router renders nothing until it has, which would blank the prerendered
   * page for a moment before the same content came back.
   */
  router?: ReturnType<typeof createAppRouter>;
};

/**
 * Application root.
 *
 * The router is created once in state rather than on every render, because
 * rebuilding it would discard the navigation history it holds.
 */
export const App = ({ router: loadedRouter }: AppProps) => {
  const [router] = useState(() => loadedRouter ?? createAppRouter());

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
};
