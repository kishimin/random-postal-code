import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import {
  guideNavigationLabel,
  guidePages,
} from "../../features/guides/guide-pages";
import { notFoundHeading } from "../document-title";
import { createAppRouter } from "../routes/app-router";

/*
 * Issue #121 review gaps the locked acceptance test cannot close: it only
 * checks that a guide's description is non-empty, and it never follows the
 * links in a guide's body. Both run through the production route
 * configuration (ADR-0011).
 */
const siteDescription = "サイト全体の説明です。";

const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return { router, ...render(<RouterProvider router={router} />) };
};

const descriptionMetas = () =>
  // eslint-disable-next-line testing-library/no-node-access -- a meta tag is not in the accessibility tree, and the description is what a crawler reads from it
  document.head.querySelectorAll<HTMLMetaElement>('meta[name="description"]');

// index.html ships the site's default description; the test document has none.
const addSiteDescription = () => {
  const meta = document.createElement("meta");
  meta.name = "description";
  meta.content = siteDescription;
  document.head.append(meta);
};

const currentDescription = (): string | undefined => {
  const metas = descriptionMetas();
  expect(metas).toHaveLength(1);

  return metas[0]?.content;
};

const goTo = async (
  router: ReturnType<typeof createAppRouter>,
  path: string,
) => {
  await act(() => Promise.resolve(router.history.push(path)));
};

afterEach(() => {
  for (const meta of descriptionMetas()) {
    meta.remove();
  }
});

describe("guide pages' meta description", () => {
  // Fails if a page skips useMetaDescription: the content would stay the
  // default read at "/".
  test.each(guidePages)(
    "$path sets its own description, different from the site's default",
    async (page) => {
      addSiteDescription();
      const { router } = renderAt("/");
      await screen.findByRole("heading", { name: /波に乗って/, level: 1 });
      const defaultDescription = currentDescription();

      await goTo(router, page.path);
      await screen.findByRole("heading", { level: 1, name: page.name });

      expect(currentDescription()).toBe(page.description);
      expect(currentDescription()).not.toBe(defaultDescription);
    },
  );

  test("navigating between guides leaves the second's description, and home restores the default", async () => {
    const [first, second] = guidePages;
    if (!first || !second) throw new Error("expected at least two guides");
    addSiteDescription();
    const { router } = renderAt("/");
    await screen.findByRole("heading", { name: /波に乗って/, level: 1 });
    const defaultDescription = currentDescription();

    await goTo(router, first.path);
    await screen.findByRole("heading", { level: 1, name: first.name });
    await goTo(router, second.path);
    await screen.findByRole("heading", { level: 1, name: second.name });

    expect(currentDescription()).toBe(second.description);

    await goTo(router, "/");
    await screen.findByRole("heading", { name: /波に乗って/, level: 1 });

    expect(currentDescription()).toBe(defaultDescription);
  });
});

describe("guide pages' internal links", () => {
  // Fails if a link points at a path no route claims: the destination would
  // render the not-found heading.
  test.each(guidePages)(
    "every internal link in $path's main content and the footer guide nav leads to a page",
    async (page) => {
      const user = userEvent.setup();
      const { router } = renderAt(page.path);
      await screen.findByRole("heading", { level: 1, name: page.name });

      const internalLinks = () =>
        [
          ...within(screen.getByRole("main")).getAllByRole("link"),
          ...within(
            screen.getByRole("navigation", { name: guideNavigationLabel }),
          ).getAllByRole("link"),
        ].filter((link) => link.getAttribute("href")?.startsWith("/"));
      const hrefs = new Set(
        internalLinks().map((link) => link.getAttribute("href") ?? ""),
      );

      expect(hrefs.size).toBeGreaterThan(0);

      for (const href of hrefs) {
        await goTo(router, page.path);
        await screen.findByRole("heading", { level: 1, name: page.name });
        const link = internalLinks().find(
          (candidate) => candidate.getAttribute("href") === href,
        );
        if (!link) throw new Error(`no link to ${href} on ${page.path}`);

        await user.click(link);

        await waitFor(() => {
          expect(router.state.location.pathname).toBe(href);
        });
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
        expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(
          notFoundHeading,
        );
        expect(
          screen.queryByRole("heading", { name: notFoundHeading }),
        ).not.toBeInTheDocument();
      }
    },
  );
});
