import type { ReactNode } from "react";
import {
  guideIndexNavigationLabel,
  guideIndexPage,
  guideNavigationLabel,
  guidePages,
} from "../../features/guides/guide-pages";
import type { GuidePath, guideIndexPath } from "../../features/guides/types";

/** What a footer link names and where it leads. */
export type FooterGuideLink = {
  readonly name: string;
  readonly path: GuidePath | typeof guideIndexPath;
};

type GuideNavigationProps = {
  /** One link; the caller picks a router Link or a plain anchor. */
  renderLink: (link: FooterGuideLink) => ReactNode;
};

/**
 * The footer's two guide landmarks (ui-design.md section 5.5): ガイド, with
 * the five guides in the contract's order (Issue #121), and すべてのガイド,
 * with the one link to the guide index (Issue #170).
 *
 * The index has a landmark of its own rather than a sixth link in ガイド, so
 * the five links every screen has shown since Issue #121 stay as they are.
 *
 * The links come in as a render prop for the reason AppFrame takes its other
 * links as nodes: the global error screen repeats the frame without the
 * router and needs plain anchors, while every other screen needs router Links
 * that keep the current page's aria-current.
 */
export const GuideNavigation = ({ renderLink }: GuideNavigationProps) => (
  <>
    <nav aria-label={guideNavigationLabel}>
      <ul className={"flex flex-wrap justify-center"}>
        {guidePages.map((page) => (
          <li key={page.path}>{renderLink(page)}</li>
        ))}
      </ul>
    </nav>
    <nav aria-label={guideIndexNavigationLabel}>
      <ul className={"flex flex-wrap justify-center"}>
        <li>{renderLink(guideIndexPage)}</li>
      </ul>
    </nav>
  </>
);
