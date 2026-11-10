import type { ReactNode } from "react";
import {
  guideNavigationLabel,
  guidePages,
} from "../../features/guides/guide-pages";
import type { GuidePage } from "../../features/guides/types";

type GuideNavigationProps = {
  /** One guide's link; the caller picks a router Link or a plain anchor. */
  renderLink: (page: Pick<GuidePage, "name" | "path">) => ReactNode;
};

/**
 * The footer's ガイド navigation (Issue #121, ui-design.md section 5.5): the
 * five guides in the contract's order, on every screen.
 *
 * The links come in as a render prop for the reason AppFrame takes its other
 * links as nodes: the global error screen repeats the frame without the
 * router and needs plain anchors, while every other screen needs router Links
 * that keep the current guide's aria-current.
 */
export const GuideNavigation = ({ renderLink }: GuideNavigationProps) => (
  <nav aria-label={guideNavigationLabel}>
    <ul className={"flex flex-wrap justify-center"}>
      {guidePages.map((page) => (
        <li key={page.path}>{renderLink(page)}</li>
      ))}
    </ul>
  </nav>
);
