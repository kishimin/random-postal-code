import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { sourcesHeading } from "../../features/guides/guide-pages";
import type { GuidePage } from "../../features/guides/types";
import { GuideView } from "../views/GuideView";

/*
 * Component-level counterpart to acceptance/web-guide-pages.medium.test.ts
 * (Issue #121): the structure one guide page renders, without a browser
 * session or the router. A guide with links to other screens needs the router
 * and is held through the production routes (guide-routes.medium.test.tsx).
 */
const page: GuidePage = {
  path: "/guide/data",
  name: "見本のページ",
  description: "見本のページの説明です。",
  lead: "見本のページの導入です。",
  sections: [
    {
      headingId: "sample-first-heading",
      heading: "最初の節",
      paragraphs: [
        "最初の節の一つ目の段落です。",
        "最初の節の二つ目の段落です。",
      ],
    },
    {
      headingId: "sample-second-heading",
      heading: "次の節",
      paragraphs: ["次の節の導入です。"],
      items: ["一つ目の項目です。", "二つ目の項目です。"],
    },
  ],
  sources: [
    { label: "見本の資料", href: "https://www.post.japanpost.jp/sample/" },
  ],
};

describe("GuideView", () => {
  test("shows the page's name as its one h1, which can take focus after a route change", () => {
    render(<GuideView page={page} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "見本のページ",
    });
    // RootLayout focuses a screen's own h1 after a client-side route change,
    // and a plain heading is not focusable without a tabindex.
    expect(heading).toHaveAttribute("tabindex", "-1");
  });

  test("shows the lead", () => {
    render(<GuideView page={page} />);

    expect(screen.getByText("見本のページの導入です。")).toBeVisible();
  });

  test("shows each section as a region named by its own h2, with its paragraphs", () => {
    render(<GuideView page={page} />);

    const first = screen.getByRole("region", { name: "最初の節" });

    expect(
      within(first).getByRole("heading", { level: 2, name: "最初の節" }),
    ).toBeVisible();
    expect(
      within(first).getByText("最初の節の一つ目の段落です。"),
    ).toBeVisible();
    expect(
      within(first).getByText("最初の節の二つ目の段落です。"),
    ).toBeVisible();
  });

  test("shows a section's items as a list", () => {
    render(<GuideView page={page} />);

    const second = screen.getByRole("region", { name: "次の節" });
    const items = within(second).getAllByRole("listitem");

    expect(items.map((item) => item.textContent)).toEqual([
      "一つ目の項目です。",
      "二つ目の項目です。",
    ]);
  });

  test("shows no list for a section without items", () => {
    render(<GuideView page={page} />);

    const first = screen.getByRole("region", { name: "最初の節" });

    expect(within(first).queryByRole("list")).not.toBeInTheDocument();
  });

  test("lists the sources as plain links in a 参考にした資料 section, after the body sections", () => {
    render(<GuideView page={page} />);

    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(["最初の節", "次の節", sourcesHeading]);

    const sources = screen.getByRole("region", { name: sourcesHeading });
    const link = within(sources).getByRole("link", { name: "見本の資料" });

    expect(link).toHaveAttribute(
      "href",
      "https://www.post.japanpost.jp/sample/",
    );
    // No new browsing context: a visitor on a phone keeps the back button.
    expect(link).not.toHaveAttribute("target");
  });

  test("ends with what its route passes, after the sources", () => {
    render(
      <GuideView page={page}>
        <a href={"/"}>{"見本の結び"}</a>
      </GuideView>,
    );

    const links = screen.getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "見本の資料",
      "見本の結び",
    ]);
    const sources = screen.getByRole("region", { name: sourcesHeading });
    expect(within(sources).queryByText("見本の結び")).not.toBeInTheDocument();
  });

  test("names the document by the page and the product", () => {
    render(<GuideView page={page} />);

    expect(document.title).toBe("見本のページ | Zipnami");
  });
});
