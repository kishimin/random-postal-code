import { useEffect } from "react";

/**
 * Keeps the browser tab's title in sync with the screen currently shown.
 *
 * A single-page application does not get a per-route title for free: unless
 * something writes it, every route keeps whatever index.html shipped, or
 * whatever the previously mounted screen last set. `document.title` is
 * browser UI outside React's own tree, which is exactly what useEffect exists
 * to synchronize with (WCAG 2.4.2, Page Titled).
 * @param title - The full title text to assign to the document.
 */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    document.title = title;
  }, [title]);
};
