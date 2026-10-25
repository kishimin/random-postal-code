import { useEffect } from "react";

/**
 * Keeps the browser tab's title in sync with the screen currently shown.
 *
 * A single-page application does not get a per-route title for free: unless
 * something writes it, every route keeps whatever index.html shipped, or
 * whatever the previously mounted screen last set. `document.title` is
 * browser UI outside React's own tree, which is exactly what useEffect exists
 * to synchronize with (WCAG 2.4.2, Page Titled).
 *
 * This alone does not close the gap between a direct navigation and the
 * title reflecting it: React's asynchronous initial mount, not effect
 * scheduling, is what let that race surface (see main.tsx's synchronous
 * titleForPathname call, which sets an immediate best guess before this hook
 * ever gets a chance to run).
 * @param {string} title - The full title text to assign to the document.
 */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
  }, [title]);
};
