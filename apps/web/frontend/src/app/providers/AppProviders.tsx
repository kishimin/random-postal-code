import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

type AppProvidersProps = {
  children: ReactNode;
};

/**
 * Composes the providers every Zipnami view depends on.
 *
 * The QueryClient is created in state rather than at module scope so each
 * mounted tree — including a Storybook story or a test — gets an isolated cache
 * instead of inheriting results from a previous render.
 */
export const AppProviders = ({ children }: AppProvidersProps) => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
