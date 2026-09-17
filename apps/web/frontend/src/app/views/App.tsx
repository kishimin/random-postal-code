import { AppProviders } from "../providers/AppProviders";

/**
 * Application shell.
 *
 * Routing, the generator experience, history, maps, and advertising are added by
 * the acceptance tests of their owning Issues (#5 through #9). This shell exists
 * so the toolchain — build, type check, lint, and test — is verifiable before
 * any product behavior is written.
 */
export const App = () => {
  return (
    <AppProviders>
      <main>
        <h1>{"Zipnami"}</h1>
      </main>
    </AppProviders>
  );
};
