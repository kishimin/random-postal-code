import { useEffect } from "react";

const ROBOTS_SELECTOR = 'meta[name="robots"]';

/**
 * Removes the document's robots directive while a page that belongs in the
 * index is shown.
 *
 * 404.html ships `noindex`, and the client carries it into every screen a
 * visitor reaches from there by following a link. The directive describes the
 * page that was loaded, not the screen now shown, so it has to go once a page
 * with an address of its own takes over. It is not put back on leaving: a
 * crawler reads the prerendered HTML, which names its own directive.
 * @param {boolean} indexable - Whether the screen shown belongs in the index.
 */
export const useIndexableDocument = (indexable: boolean) => {
  useEffect(() => {
    if (!indexable) return;

    for (const robots of document.head.querySelectorAll(ROBOTS_SELECTOR)) {
      robots.remove();
    }
  }, [indexable]);
};
