import { useEffect } from "react";

const DESCRIPTION_SELECTOR = 'meta[name="description"]';

/**
 * Keeps the page's meta description in sync with the screen currently shown.
 *
 * Like the document title, it is browser-owned state outside React's tree, so
 * it is synchronized in an effect. Each prerendered file ships its own page's
 * description, and a crawler that renders the page reads whatever is there
 * once the route has mounted (Issue #121, #169).
 *
 * Leaving the screen puts the site's default back instead of leaving the last
 * guide's description on every screen after it. It is given rather than read
 * from the document: the document starts with the description of whichever
 * page was prerendered, which is no more the site's default than a guide's is.
 * When the document has no description tag at all, one is added and removed
 * again, so the hook works the same wherever it is mounted.
 * @param {string} description - The one-sentence summary of the current screen.
 * @param {string} siteDefault - The description the site has when no screen
 * names its own.
 */
export const useMetaDescription = (
  description: string,
  siteDefault: string,
) => {
  useEffect(() => {
    const existing =
      document.head.querySelector<HTMLMetaElement>(DESCRIPTION_SELECTOR);
    const meta = existing ?? document.createElement("meta");

    if (!existing) {
      meta.name = "description";
      document.head.append(meta);
    }
    meta.content = description;

    return () => {
      if (existing) {
        meta.content = siteDefault;
      } else {
        meta.remove();
      }
    };
  }, [description, siteDefault]);
};
