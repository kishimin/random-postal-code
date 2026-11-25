import { Link } from "@tanstack/react-router";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { notFoundHeading } from "../document-title";
import { pageTitle, siteText } from "../site-text";
import { primaryActionClass } from "../styles";

/**
 * Destination for a path no route claims.
 *
 * Prerendered as 404.html, which Pages answers a path no file matches with
 * (status 404). The client renders the same screen for a path it is handed by
 * the router, such as one the visitor types after the page has loaded.
 */
export const NotFoundView = () => {
  useDocumentTitle(pageTitle(notFoundHeading));

  return (
    <div className={"flex flex-col items-center gap-4 py-12 text-center"}>
      {/* The numeral is Figma's decoration; the heading already says what
          happened, so a screen reader skips it. The brand color on the page
          surface is 5.41:1, AA for normal text as well. */}
      <p aria-hidden={"true"} className={"text-giant font-bold text-brand"}>
        {"404"}
      </p>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5), and a plain heading is not in the
          focusable area without one. */}
      <h1 tabIndex={-1} className={"text-headline font-bold text-ink"}>
        {notFoundHeading}
      </h1>
      <p className={"text-body-sm text-ink-muted"}>
        {"URLが正しいか確認するか、トップページへ戻ってください。"}
      </p>
      <Link className={`${primaryActionClass} mt-4`} to={"/"}>
        {siteText.backToGenerator}
      </Link>
    </div>
  );
};
