import { Component, type ReactNode } from "react";
import { AppErrorView } from "../views/AppErrorView";

type RootErrorBoundaryProps = {
  children: ReactNode;
};

type RootErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Catches a render failure anywhere below it and shows a usable screen.
 *
 * A class because React offers no hook equivalent. It catches what renders
 * below it and nothing above: the copy inside AppProviders covers the router's
 * rendering, and main.tsx mounts another outside App so that building the
 * router is covered too.
 *
 * The error object is deliberately not held in state. Nothing on the screen
 * shows it, so keeping it would only invite a later change to display it. It
 * is still written to the console, because not showing a visitor the detail is
 * a different decision from keeping no record of it.
 */
export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  state: RootErrorBoundaryState = { hasError: false };

  /** Switches to the error screen on the render pass that caught the failure. */
  static getDerivedStateFromError(): RootErrorBoundaryState {
    return { hasError: true };
  }

  /** Leaves a record of a failure the screen deliberately says nothing about. */
  componentDidCatch(error: unknown) {
    /*
     * Zipnami ships no error reporting service, so the alternative to this
     * line is no record at all of a crash a visitor saw. The screen stays
     * silent about the detail; the console does not have to.
     */
    // eslint-disable-next-line no-console -- the only sink this application has
    console.error(
      "Zipnami: a render failed and reached the root boundary.",
      error,
    );
  }

  /** Renders the error screen once a failure has been caught. */
  render() {
    if (this.state.hasError) {
      return <AppErrorView />;
    }

    return this.props.children;
  }
}
