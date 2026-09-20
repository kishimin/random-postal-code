import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { createAppRouter } from "../routes/app-router";

/*
 * Navigation is exercised through the production route configuration rather
 * than a tree assembled for the test, as ADR-0011 requires. A test-only tree
 * would keep passing after the real one broke.
 */
const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return render(<RouterProvider router={router} />);
};

describe("application routes", () => {
  test("the root path renders the generator screen inside a main landmark", async () => {
    renderAt("/");

    expect(
      await screen.findByRole("heading", { name: /Zipnami/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  test("the privacy path renders the privacy screen inside a main landmark", async () => {
    renderAt("/privacy");

    expect(
      await screen.findByRole("heading", { name: /プライバシー/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  test("a path no route claims renders the not-found screen, not the generator", async () => {
    renderAt("/this-path-does-not-exist");

    expect(
      await screen.findByRole("heading", {
        name: /ページが見つかりません/,
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Zipnami/, level: 1 }),
    ).not.toBeInTheDocument();
  });
});
