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
 * A class because React offers no hook equivalent. Placed above the router so
 * a failure in routing itself is still caught; below it, a broken router would
 * take the boundary with it.
 *
 * The error object is deliberately not held in state. Nothing on the screen
 * shows it, so keeping it would only invite a later change to display it.
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

  /** Renders the error screen once a failure has been caught. */
  render() {
    if (this.state.hasError) {
      return <AppErrorView />;
    }

    return this.props.children;
  }
}
