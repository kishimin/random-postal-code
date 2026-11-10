import { useEffect } from "react";

const DESCRIPTION_SELECTOR = 'meta[name="description"]';

/**
 * Keeps the page's meta description in sync with the screen currently shown.
 *
 * Like the document title, it is browser-owned state outside React's tree, so
 * it is synchronized in an effect. A single-page application ships one
 * description in index.html, and a crawler that renders the page reads
 * whatever is there once the route has mounted (Issue #121).
 *
 * Leaving the screen puts back what was there before -- the site's default
 * from index.html -- instead of leaving the last guide's description on every
 * screen after it. When the document has no description tag at all, one is
 * added and removed again, so the hook works the same wherever it is mounted.
 * @param {string} description - The one-sentence summary of the current screen.
 */
export const useMetaDescription = (description: string) => {
  useEffect(() => {
    const existing =
      document.head.querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR);
    const meta = existing ?? document.createElement("meta");
    const previous = meta.content;

    if (!existing) {
      meta.name = "description";
      document.head.append(meta);
    }
    meta.content = description;

    return () => {
      if (existing) {
        meta.content = previous;
      } else {
        meta.remove();
      }
    };
  }, [description]);
};
