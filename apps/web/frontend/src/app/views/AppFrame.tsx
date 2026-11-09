import type { ReactNode, Ref } from "react";
import logoUrl from "../../images/logo.svg";
import { siteText } from "../site-text";
import {
  footerTextClass,
  frameInnerClass,
  headerClass,
  mainInnerClass,
} from "../styles";

type AppFrameProps = {
  /** The wordmark link; the caller picks a router Link or a plain anchor. */
  wordmark: ReactNode;
  /** The footer's privacy link, picked the same way. */
  privacyLink: ReactNode;
  mainRef?: Ref<HTMLElement>;
  children: ReactNode;
};

/**
 * The header, main, and footer every screen shares.
 *
 * Landmarks live here rather than in each screen, so a route added later
 * cannot ship without them. The global error screen repeats this frame with
 * plain anchors (AppErrorView), which is why the links come in as nodes.
 */
export const AppFrame = ({
  wordmark,
  privacyLink,
  mainRef,
  children,
}: AppFrameProps) => (
  <div className={"flex min-h-dvh flex-col bg-page"}>
    <header className={headerClass}>
      <div
        className={`${frameInnerClass} flex min-h-16 items-center gap-6 lg:min-h-20`}
      >
        <div className={"flex items-center gap-2"}>
          {/* Decorative: the wordmark right after it already names the site,
              so an alt text would make a screen reader say Zipnami twice. It
              sits outside the link so the link's name stays exactly the
              wordmark. */}
          <img
            src={logoUrl}
            alt={""}
            width={48}
            height={32}
            className={"h-8 w-12 shrink-0"}
          />
          {wordmark}
        </div>
        <p className={"hidden text-body-sm text-ink-muted lg:block"}>
          {siteText.tagline}
        </p>
      </div>
    </header>

    <main ref={mainRef} className={`${mainInnerClass} flex-1 py-8 lg:py-12`}>
      {children}
    </main>

    <footer className={"py-8"}>
      <div
        className={`${frameInnerClass} flex flex-col items-center gap-1 text-center`}
      >
        {privacyLink}
        <p className={footerTextClass}>{siteText.attribution}</p>
        <p className={footerTextClass}>{siteText.copyright}</p>
      </div>
    </footer>
  </div>
);
