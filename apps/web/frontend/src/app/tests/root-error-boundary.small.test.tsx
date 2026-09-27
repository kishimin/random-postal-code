import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AppProviders } from "../providers/AppProviders";
import { siteText } from "../site-text";

const thrownDetail = "connection string leaked into the message";

const Throwing = () => {
  throw new Error(thrownDetail);
};

describe("root error boundary", () => {
  test("a render failure leaves a usable screen instead of a blank page", () => {
    // React logs the caught error. Silenced so a passing run does not print a
    // stack that reads like a failure.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppProviders>
        <Throwing />
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { name: /問題が発生しました/, level: 1 }),
    ).toBeInTheDocument();
  });

  test("the screen offers a way back to the generator", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppProviders>
        <Throwing />
      </AppProviders>,
    );

    expect(
      screen.getByRole("link", { name: /トップへ戻る/ }),
    ).toBeInTheDocument();
  });

  test("the screen keeps the header and the footer attribution", () => {
    // AppErrorView repeats the frame by hand instead of reusing RootLayout, so
    // nothing but this keeps the two from drifting apart.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppProviders>
        <Throwing />
      </AppProviders>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText(siteText.attribution)).toBeInTheDocument();
  });

  test("focus moves to the error summary the crash would otherwise strand", () => {
    // The live region mounts already filled in, so a screen reader may never
    // announce it. The crash also replaced the page under the visitor's focus.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppProviders>
        <Throwing />
      </AppProviders>,
    );

    expect(screen.getByRole("alert")).toHaveFocus();
  });

  // CR-006 of Issue #10's review: a title has to name this screen too, not
  // only the routes the router itself resolves, so it reads as its own entry
  // in a screen reader's window list rather than as whatever the previous
  // screen left behind.
  test("the screen's document title names the failure", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppProviders>
        <Throwing />
      </AppProviders>,
    );

    expect(document.title).toMatch(/問題が発生しました/);
  });

  test("the screen does not expose the thrown detail", () => {
    // api-design.md section 4.2 keeps internal detail off the public boundary.
    // The same applies here: a stack or a message meant for a log tells a
    // visitor nothing and can carry what should not be shown.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppProviders>
        <Throwing />
      </AppProviders>,
    );

    expect(screen.queryByText(thrownDetail)).not.toBeInTheDocument();
  });
});
