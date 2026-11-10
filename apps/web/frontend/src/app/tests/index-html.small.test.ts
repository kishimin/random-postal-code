import { describe, expect, test } from "vitest";
import indexHtml from "../../../index.html?raw";

/*
 * index.html is what every route first ships, so what it carries is what a
 * crawler reads from a page that sets nothing of its own: the generator, the
 * privacy page, and whatever path the router does not claim. The guide pages
 * replace it while they are shown and hand it back (use-meta-description.ts).
 */
describe("index.html", () => {
  test("ships the site's default description", () => {
    const document = new DOMParser().parseFromString(indexHtml, "text/html");

    // Read as an attribute rather than matched with toHaveAttribute: the
    // parsed document is a separate realm, so jest-dom does not accept its
    // elements.
    expect(
      document.head
        .querySelector('meta[name="description"]')
        ?.getAttribute("content"),
    ).toBe(
      "日本の郵便番号をランダムに1つ選び、その番号に対応するすべての住所と地図を表示します。",
    );
  });
});
