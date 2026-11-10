import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { createAppRouter } from "../routes/app-router";

/*
 * ui-design.md section 5.5: the footer of every screen carries one navigation
 * landmark named ガイド with the five guides in order, and on a guide page the
 * link to that page keeps its place and says it is the current page. Rendered
 * through the production routes (ADR-0011), so a screen added later without
 * the frame fails here.
 */
const guideLinks = [
  { name: "サイトについて", href: "/about" },
  { name: "郵便番号のしくみ", href: "/guide/postal-code" },
  { name: "郵便番号と住所", href: "/guide/address" },
  { name: "データについて", href: "/guide/data" },
  { name: "使い方", href: "/guide/how-to-use" },
] as const;

const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return render(<RouterProvider router={router} />);
};

const footerNavigation = () =>
  within(screen.getByRole("contentinfo")).getByRole("navigation", {
    name: "ガイド",
  });

describe("the footer's guide navigation", () => {
  test.each([
    ["the generator", "/", /波に乗って/],
    ["the privacy page", "/privacy", /プライバシー/],
    ["the not-found screen", "/no-such-path", /ページが見つかりません/],
    ["a guide page", "/guide/address", /郵便番号と住所/],
  ])(
    "on %s it lists the five guides in order, each linking to its route",
    async (_screen, path, heading) => {
      renderAt(path);
      await screen.findByRole("heading", { name: heading, level: 1 });

      const links = within(footerNavigation()).getAllByRole("link");

      expect(links.map((link) => link.textContent)).toEqual(
        guideLinks.map(({ name }) => name),
      );
      expect(links.map((link) => link.getAttribute("href"))).toEqual(
        guideLinks.map(({ href }) => href),
      );
    },
  );

  test.each(guideLinks)(
    "on $href the link to that page is the only one marked as the current page",
    async ({ name, href }) => {
      renderAt(href);
      await screen.findByRole("heading", { name, level: 1 });

      for (const link of guideLinks) {
        const element = within(footerNavigation()).getByRole("link", {
          name: link.name,
        });

        if (link.href === href) {
          expect(element).toHaveAttribute("aria-current", "page");
        } else {
          expect(element).not.toHaveAttribute("aria-current");
        }
      }
    },
  );

  test("marks no guide as the current page on screens that are not a guide", async () => {
    renderAt("/privacy");
    await screen.findByRole("heading", { name: /プライバシー/, level: 1 });

    for (const { name } of guideLinks) {
      expect(
        within(footerNavigation()).getByRole("link", { name }),
      ).not.toHaveAttribute("aria-current");
    }
  });

  test("keeps the footer's privacy link beside the guides, which the guide pages do not replace", async () => {
    renderAt("/guide/data");
    await screen.findByRole("heading", { name: "データについて", level: 1 });

    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", {
        name: "プライバシーポリシー",
      }),
    ).toHaveAttribute("href", "/privacy");
  });
});
