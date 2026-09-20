import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { AppProviders } from "../providers/AppProviders";
import { createAppRouter } from "../routes/app-router";

/**
 * Application root.
 *
 * The router is created once in state rather than on every render, because
 * rebuilding it would discard the navigation history it holds.
 */
export const App = () => {
  const [router] = useState(() => createAppRouter());

  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
};
