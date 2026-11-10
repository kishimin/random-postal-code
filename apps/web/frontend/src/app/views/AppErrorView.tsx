import { siteText } from "../site-text";
import { guideLinkClass, privacyLinkClass, wordmarkClass } from "../styles";
import { AppErrorContent } from "./AppErrorContent";
import { AppFrame } from "./AppFrame";
import { GuideNavigation } from "./GuideNavigation";

/**
 * Destination for a failure that left no usable page at all.
 *
 * The frame is repeated here with plain anchors rather than reused from
 * RootLayout, because this screen answers a render that already failed.
 * Reusing router-aware components would depend on the part that may be broken,
 * and a full page load is the right way back after a crash anyway. That
 * includes the footer's guide links, which are plain anchors too.
 *
 * Used by RootErrorBoundary, which sits outside the router. A route that fails
 * while the layout still renders gets AppErrorContent instead, so the frame
 * appears once rather than twice.
 *
 * Figma's Global Error frames draw no wordmark, but every screen shows one
 * (Issue #97), so the frame keeps its header.
 */
export const AppErrorView = () => {
  return (
    <AppFrame
      wordmark={
        <a className={wordmarkClass} href={"/"}>
          {siteText.wordmark}
        </a>
      }
      guideNavigation={
        <GuideNavigation
          renderLink={(page) => (
            <a className={guideLinkClass} href={page.path}>
              {page.name}
            </a>
          )}
        />
      }
      privacyLink={
        <a className={privacyLinkClass} href={"/privacy"}>
          {siteText.privacyLabel}
        </a>
      }
    >
      <AppErrorContent />
    </AppFrame>
  );
};
