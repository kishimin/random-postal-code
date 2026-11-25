import { useCanonicalLink } from "../hooks/use-canonical-link";
import { useDocumentTitle } from "../hooks/use-document-title";
import { useIndexableDocument } from "../hooks/use-indexable-document";
import { useMetaDescription } from "../hooks/use-meta-description";
import { canonicalUrlOf } from "./deployment/site-origin";
import { siteDescription, type PageMetadata } from "./page-metadata";

/**
 * Keeps the document's title, description and canonical link describing the
 * content route on screen, and drops a noindex left over from 404.html.
 *
 * Given metadata from the same table the build writes each prerendered file's
 * head from, so a screen cannot claim something else once the client has
 * taken over.
 * @param {PageMetadata} metadata - What the screen on display is called.
 */
export const usePageHead = ({
  title,
  description,
  canonicalPath,
}: PageMetadata) => {
  useDocumentTitle(title);
  useMetaDescription(description, siteDescription);
  useCanonicalLink(
    canonicalPath === null ? null : canonicalUrlOf(canonicalPath),
  );
  useIndexableDocument(canonicalPath !== null);
};
