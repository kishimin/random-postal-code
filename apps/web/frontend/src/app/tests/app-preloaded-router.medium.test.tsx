import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { createAppRouter } from "../routes/app-router";
import { App } from "../views/App";

/*
 * The prerendered HTML is on screen until React replaces it. A router that has
 * not matched its first route renders nothing, so mounting an unloaded router
 * would blank the page for a moment before the content came back; main.tsx
 * loads the router first and hands it to App (Issue #169).
 */
describe("App with a router that has already loaded", () => {
  test("shows the route's screen on the first render, with nothing blank in between", async () => {
    const router = createAppRouter(
      createMemoryHistory({ initialEntries: ["/about"] }),
    );
    await router.load();

    render(<App router={router} />);

    // getBy, not findBy: nothing may be awaited between mounting and the
    // content.
    expect(
      screen.getByRole("heading", { level: 1, name: "サイトについて" }),
    ).toBeInTheDocument();
  });
});
