import { useEffect, useRef } from "react";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { pageTitle, siteText } from "../site-text";
import { tapTargetClass } from "../styles";

// Reused for both the visible heading and the document title, so the two
// never drift into two different phrasings of the same failure.
const HEADING = "問題が発生しました";

/**
 * What a visitor reads after a render failed, with no frame of its own.
 *
 * The router renders its fallback at the failing route's match, inside the
 * layout's Outlet, so a version carrying its own header and footer would nest
 * a second main landmark inside the first. NotFoundView is shaped the same way
 * and for the same reason. AppErrorView wraps this when the failure happened
 * somewhere the layout cannot be trusted to render.
 *
 * The way back is a plain anchor rather than a Link. This component renders
 * both inside the router and outside it, and a full page load is the right way
 * back after a crash in either case.
 *
 * The thrown error is not shown. It tells a visitor nothing they can act on,
 * and a message written for a log can carry detail that should not be
 * published — the same boundary api-design.md section 4.2 sets for the API.
 */
export const AppErrorContent = () => {
  const summaryRef = useRef<HTMLDivElement>(null);

  // CR-006 of Issue #10's review, applied here too: a title has to name this
  // screen the same way the routed ones do (WCAG 2.4.2).
  useDocumentTitle(pageTitle(HEADING));

  /*
   * A live region only announces what changes after it is observed, and this
   * one arrives already filled in, so a screen reader may say nothing at all.
   * The failure also replaced what the visitor was reading, which leaves focus
   * on a node that no longer exists. Moving focus here answers both, and
   * ui-design.md section 11 allows it when the error is one the visitor must
   * act on.
   */
  useEffect(() => {
    summaryRef.current?.focus();
  }, []);

  return (
    <>
      <div ref={summaryRef} role={"alert"} tabIndex={-1}>
        <h1>{HEADING}</h1>
        <p>{"画面を表示できませんでした。時間をおいて再度お試しください。"}</p>
      </div>
      <a className={tapTargetClass} href={"/"}>
        {siteText.backToGenerator}
      </a>
    </>
  );
};
