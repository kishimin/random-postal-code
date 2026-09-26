import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { pageTitle, siteText } from "../site-text";
import { linkClass } from "../styles";

// Reused for both the visible heading and the document title, so the two
// never drift into two different phrasings of the same screen.
const HEADING = "ページが見つかりません";

/**
 * Destination for a path no route claims.
 *
 * Reached through the router rather than the server: Pages answers every path
 * with index.html, so the router is what distinguishes a mistyped address from
 * a real one.
 */
export const NotFoundView = () => {
  useDocumentTitle(pageTitle(HEADING));

  return (
    <>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5), and a plain heading is not in the
          focusable area without one. */}
      <h1 tabIndex={-1}>{HEADING}</h1>
      <p>
        {"お探しのページは移動したか、アドレスが誤っている可能性があります。"}
      </p>
      <Link className={linkClass} to={"/"}>
        {siteText.backToGenerator}
      </Link>
    </>
  );
};
