import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { createAppRouter } from "../routes/app-router";

/*
 * WCAG 2.4.2 (Page Titled, Level A): a title has to describe the page's own
 * topic, which is what lets a visitor tell two open tabs, two history
 * entries, or two rows in a screen reader's window list apart. index.html
 * ships one static "Zipnami" title with nothing in this codebase that ever
 * changed it, so every route read the same title no matter which screen was
 * showing (CR-006 of Issue #10's review, held for the acceptance test by
 * Issue #16).
 *
 * Rendered through the production route configuration (ADR-0011), so a route
 * added later without wiring a title fails here instead of only in the
 * browser suite.
 */
const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return render(<RouterProvider router={router} />);
};

describe("document title per screen", () => {
  test("the generator screen's title names the product", async () => {
    renderAt("/");

    await screen.findByRole("heading", { name: /Zipnami/, level: 1 });
    expect(document.title).toMatch(/Zipnami/);
  });

  test("the privacy screen's title names the privacy screen", async () => {
    renderAt("/privacy");

    await screen.findByRole("heading", { name: /プライバシー/, level: 1 });
    expect(document.title).toMatch(/プライバシー/);
  });

  test("the not-found screen's title names the not-found screen", async () => {
    renderAt("/this-path-does-not-exist");

    await screen.findByRole("heading", {
      name: /ページが見つかりません/,
      level: 1,
    });
    expect(document.title).toMatch(/見つかりません/);
  });

  // A title that describes every screen at once describes none of them.
  // Each render is unmounted before the next starts, so the three screens'
  // titles are captured one at a time instead of three trees left stacked in
  // the same document.
  test("gives the three screens three different titles", async () => {
    const generatorScreen = renderAt("/");
    await screen.findByRole("heading", { name: /Zipnami/, level: 1 });
    const generatorTitle = document.title;
    generatorScreen.unmount();

    const privacyScreen = renderAt("/privacy");
    await screen.findByRole("heading", { name: /プライバシー/, level: 1 });
    const privacyTitle = document.title;
    privacyScreen.unmount();

    const notFoundScreen = renderAt("/this-path-does-not-exist");
    await screen.findByRole("heading", {
      name: /ページが見つかりません/,
      level: 1,
    });
    const notFoundTitle = document.title;
    notFoundScreen.unmount();

    expect(new Set([generatorTitle, privacyTitle, notFoundTitle]).size).toBe(3);
  });
});
