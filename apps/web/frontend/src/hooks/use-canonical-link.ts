import { useEffect } from "react";

const CANONICAL_SELECTOR = 'link[rel="canonical"]';

/**
 * Keeps the document's canonical link naming the screen currently shown.
 *
 * The prerendered HTML ships the landing page's canonical link, so an existing
 * one is retargeted rather than a second added, which would give a crawler two
 * addresses to choose from. Leaving the screen removes the link: the next
 * screen names its own, and one without an address names none.
 * @param {string | null} href - The screen's absolute URL, or null for a
 * screen that has none.
 */
export const useCanonicalLink = (href: string | null) => {
  useEffect(() => {
    if (href === null) return;

    const link =
      document.head.querySelector<HTMLLinkElement>(CANONICAL_SELECTOR) ??
      document.createElement("link");
    link.rel = "canonical";
    link.href = href;
    if (!link.isConnected) document.head.append(link);

    return () => {
      link.remove();
    };
  }, [href]);
};
