import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useDocumentTitle } from "./use-document-title";

describe("useDocumentTitle", () => {
  test("sets document.title to the given value", () => {
    renderHook(() => useDocumentTitle("Example title"));

    expect(document.title).toBe("Example title");
  });

  // A screen that stays mounted while its own title changes -- there is no
  // such case in this application today, but a hook that only worked once
  // would be a trap for whatever uses it next.
  test("updates document.title when the given value changes", () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "First title" },
    });

    rerender({ title: "Second title" });

    expect(document.title).toBe("Second title");
  });
});
