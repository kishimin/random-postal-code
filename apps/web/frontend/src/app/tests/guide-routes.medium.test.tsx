import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  guidePages,
  sourcesHeading,
} from "../../features/guides/guide-pages";
import { createAppRouter } from "../routes/app-router";

/*
 * Issue #121: the five guide pages are ordinary client-rendered routes, like
 * /privacy. Rendered through the production route configuration (ADR-0011), so
 * a guide whose route was never registered renders the not-found screen here
 * instead of only in the browser suite.
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
const addSiteDescription = (): HTMLMetaElement => {
  const meta = document.createElement("meta");
  meta.name = "description";
  meta.content = siteDescription;
  document.head.append(meta);

  return meta;
};

afterEach(() => {
  for (const meta of descriptionMetas()) {
    meta.remove();
  }
  vi.restoreAllMocks();
});

describe("guide routes", () => {
  test.each(guidePages)(
    "$path renders its page in main, under one h1 with the page's name",
    async (page) => {
      renderAt(page.path);

      expect(
        await screen.findByRole("heading", { level: 1, name: page.name }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(
        within(screen.getByRole("main")).getByRole("heading", { level: 1 }),
      ).toHaveTextContent(page.name);
      expect(
        screen.queryByRole("heading", { name: /ページが見つかりません/ }),
      ).not.toBeInTheDocument();
    },
  );

  test.each(guidePages)(
    "$path names the document by its page and the product",
    async (page) => {
      renderAt(page.path);

      await screen.findByRole("heading", { level: 1, name: page.name });
      expect(document.title).toBe(`${page.name} | Zipnami`);
    },
  );

  test.each(guidePages)(
    "$path shows its content without asking the API for anything",
    async (page) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      renderAt(page.path);

      await screen.findByRole("heading", { level: 1, name: page.name });
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  test("/about links to the privacy policy and to the data page", async () => {
    renderAt("/about");

    await screen.findByRole("heading", { level: 1, name: "サイトについて" });
    const main = within(screen.getByRole("main"));

    expect(
      main.getByRole("link", { name: "プライバシーポリシー" }),
    ).toHaveAttribute("href", "/privacy");
    expect(main.getByRole("link", { name: "データについて" })).toHaveAttribute(
      "href",
      "/guide/data",
    );
  });

  // The header logo was the only way home from a guide page (owner decision
  // on Issue #121, 2026-11-11). The label is written out rather than read
  // from siteText: it is the visible copy the owner chose, so a change to the
  // constant alone should fail here.
  test.each(guidePages)(
    "$path ends its content, after the sources, with one トップへ戻る link to the generator",
    async (page) => {
      renderAt(page.path);

      await screen.findByRole("heading", { level: 1, name: page.name });
      const links = within(screen.getByRole("main")).getAllByRole("link");
      const last = links.at(-1);
      const sources = screen.getByRole("region", { name: sourcesHeading });

      expect(
        links.filter((link) => link.textContent === "トップへ戻る"),
      ).toHaveLength(1);
      expect(last?.textContent).toBe("トップへ戻る");
      expect(last).toHaveAttribute("href", "/");
      expect(
        within(sources).queryByRole("link", { name: "トップへ戻る" }),
      ).not.toBeInTheDocument();
      // Document order is what "after the sources, last in the content"
      // means, and the accessibility tree does not expose siblings.
      // eslint-disable-next-line testing-library/no-node-access -- see above
      expect(last?.previousElementSibling).toBe(sources);
      // eslint-disable-next-line testing-library/no-node-access -- see above
      expect(last?.nextElementSibling).toBeNull();
    },
  );

  test("sets the page's own meta description, and the site's default returns when the page is left", async () => {
    const siteMeta = addSiteDescription();
    const { router } = renderAt("/guide/data");
    const dataGuide = guidePages.find((page) => page.path === "/guide/data");

    await screen.findByRole("heading", { level: 1, name: "データについて" });
    expect(siteMeta.content).toBe(dataGuide?.description);

    await act(() => router.navigate({ to: "/" }));
    await screen.findByRole("heading", { name: /波に乗って/, level: 1 });

    expect(descriptionMetas()).toHaveLength(1);
    expect(siteMeta.content).toBe(siteDescription);
  });
});
