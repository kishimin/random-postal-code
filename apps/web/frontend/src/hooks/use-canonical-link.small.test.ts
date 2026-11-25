import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useCanonicalLink } from "./use-canonical-link";

const canonicalLinks = () =>
  // eslint-disable-next-line testing-library/no-node-access -- a link tag is not in the accessibility tree, and a crawler reads the canonical URL from it
  document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]');

afterEach(() => {
  for (const link of canonicalLinks()) {
    link.remove();
  }
});

describe("useCanonicalLink", () => {
  test("adds the canonical link when the document has none", () => {
    renderHook(() => useCanonicalLink("https://example.test/a"));

    expect([...canonicalLinks()].map((link) => link.href)).toEqual([
      "https://example.test/a",
    ]);
  });

  // The prerendered page ships its own canonical link; a second one would
  // give a crawler two addresses to choose from.
  test("replaces the address of the link the document shipped with instead of adding a second", () => {
    const shipped = document.createElement("link");
    shipped.rel = "canonical";
    shipped.href = "https://example.test/shipped";
    document.head.append(shipped);

    renderHook(() => useCanonicalLink("https://example.test/a"));

    expect([...canonicalLinks()].map((link) => link.href)).toEqual([
      "https://example.test/a",
    ]);
  });

  test("leaves no canonical link behind when the screen is left", () => {
    const { unmount } = renderHook(() =>
      useCanonicalLink("https://example.test/a"),
    );

    unmount();

    expect(canonicalLinks()).toHaveLength(0);
  });

  test("follows the address it is given", () => {
    const { rerender } = renderHook(({ href }) => useCanonicalLink(href), {
      initialProps: { href: "https://example.test/a" },
    });

    rerender({ href: "https://example.test/b" });

    expect([...canonicalLinks()].map((link) => link.href)).toEqual([
      "https://example.test/b",
    ]);
  });

  // A path no route claims has no address of its own.
  test("adds no link for a screen without an address", () => {
    renderHook(() => useCanonicalLink(null));

    expect(canonicalLinks()).toHaveLength(0);
  });
});
