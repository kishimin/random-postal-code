import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { useMetaDescription } from "./use-meta-description";

const descriptionMetas = () =>
  // eslint-disable-next-line testing-library/no-node-access -- a meta tag is not in the accessibility tree, and a crawler reads the description from it
  document.head.querySelectorAll<HTMLMetaElement>('meta[name="description"]');

const addDescription = (content: string): HTMLMetaElement => {
  const meta = document.createElement("meta");
  meta.name = "description";
  meta.content = content;
  document.head.append(meta);

  return meta;
};

afterEach(() => {
  for (const meta of descriptionMetas()) {
    meta.remove();
  }
});

describe("useMetaDescription", () => {
  test("sets the content of the document's description", () => {
    const meta = addDescription("既定の説明");

    renderHook(() => useMetaDescription("このページの説明"));

    expect(meta.content).toBe("このページの説明");
    expect(descriptionMetas()).toHaveLength(1);
  });

  test("restores the previous description when the screen is left", () => {
    const meta = addDescription("既定の説明");
    const { unmount } = renderHook(() =>
      useMetaDescription("このページの説明"),
    );

    unmount();

    expect(meta.content).toBe("既定の説明");
  });

  // The description a crawler reads must exist even where index.html shipped
  // none, and must not outlive the screen that set it.
  test("adds a description when the document has none, and removes it when the screen is left", () => {
    const { unmount } = renderHook(() =>
      useMetaDescription("このページの説明"),
    );

    expect(descriptionMetas()).toHaveLength(1);
    expect(descriptionMetas()[0]?.content).toBe("このページの説明");

    unmount();

    expect(descriptionMetas()).toHaveLength(0);
  });

  test("updates the description when the given value changes, and still restores the original at the end", () => {
    const meta = addDescription("既定の説明");
    const { rerender, unmount } = renderHook(
      ({ description }) => useMetaDescription(description),
      { initialProps: { description: "一つ目の説明" } },
    );

    rerender({ description: "二つ目の説明" });

    expect(meta.content).toBe("二つ目の説明");

    unmount();

    expect(meta.content).toBe("既定の説明");
  });
});
