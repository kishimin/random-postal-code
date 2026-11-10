import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppErrorView } from "../views/AppErrorView";

/*
 * The global error screen repeats the frame without the router, which is why
 * its guide links are plain anchors: a full page load is the way back after a
 * crash. It still has to carry the footer's ガイド navigation, or the one
 * screen a visitor lands on after a failure would be the one without an
 * escape route (ui-design.md section 5.5, Issue #121 AC-6).
 */
describe("AppErrorView's guide navigation", () => {
  test("lists the five guides in order as plain links to their routes, without needing the router", () => {
    render(<AppErrorView />);

    const navigation = within(screen.getByRole("contentinfo")).getByRole(
      "navigation",
      { name: "ガイド" },
    );
    const links = within(navigation).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual([
      "サイトについて",
      "郵便番号のしくみ",
      "郵便番号と住所",
      "データについて",
      "使い方",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/about",
      "/guide/postal-code",
      "/guide/address",
      "/guide/data",
      "/guide/how-to-use",
    ]);
  });

  test("keeps the privacy link", () => {
    render(<AppErrorView />);

    expect(
      within(screen.getByRole("contentinfo")).getByRole("link", {
        name: "プライバシーポリシー",
      }),
    ).toHaveAttribute("href", "/privacy");
  });
});
