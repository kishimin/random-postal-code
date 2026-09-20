import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AppProviders } from "../providers/AppProviders";

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
