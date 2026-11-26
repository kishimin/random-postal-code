import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  guidePageAt,
  relatedGuidesHeading,
  sourcesHeading,
} from "../../features/guides/guide-pages";
import type { GuidePage } from "../../features/guides/types";
import { guideMetadataOf } from "../page-metadata";
import {
  contentLinkClass,
  guideListClass as listClass,
  guideParagraphClass as paragraphClass,
  guideSectionClass as sectionClass,
  guideSectionHeadingClass as sectionHeadingClass,
} from "../styles";
import { usePageHead } from "../use-page-head";

const SOURCES_HEADING_ID = "guide-sources-heading";
const RELATED_HEADING_ID = "guide-related-heading";

type GuideViewProps = {
  page: GuidePage;
  /** What ends the page, after the sources. */
  children?: ReactNode;
};

/**
 * One guide page (Issue #121, ui-design.md section 5.5): a lead, body sections
 * each a region named by its own visible h2, the related guides, the sources
 * it relies on, and whatever the route ends the page with.
 *
 * Laid out like PrivacyView, which is also text on cards, and for the same
 * reason labelled the same way: aria-labelledby on the visible heading rather
 * than an invisible aria-label. It renders from the page's copy alone, so it
 * needs no generation and makes no request.
 */
export const GuideView = ({ page, children }: GuideViewProps) => {
  usePageHead(guideMetadataOf(page));

  return (
    <div className={"mx-auto flex max-w-[720px] flex-col gap-6"}>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5), and a plain heading is not in the
          focusable area without one. */}
      <h1 tabIndex={-1} className={"text-headline font-bold text-ink"}>
        {page.name}
      </h1>
      <p className={paragraphClass}>{page.lead}</p>

      {page.sections.map((section) => (
        <section
          key={section.headingId}
          aria-labelledby={section.headingId}
          className={sectionClass}
        >
          <h2 id={section.headingId} className={sectionHeadingClass}>
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className={paragraphClass}>
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className={`${listClass} list-disc`}>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.links && (
            <ul className={listClass}>
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link className={contentLinkClass} to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* Navigation to other guides (Issue #170): each link carries the
          guide's own name, and the summary after it says what the guide
          covers, so the list reads on its own. Every shipped guide names
          two or more (guide-pages.small.test.ts); an empty list renders no
          empty region. */}
      {page.related.length > 0 && (
        <section aria-labelledby={RELATED_HEADING_ID} className={sectionClass}>
          <h2 id={RELATED_HEADING_ID} className={sectionHeadingClass}>
            {relatedGuidesHeading}
          </h2>
          <ul className={listClass}>
            {page.related.map(guidePageAt).map((related) => (
              <li key={related.path}>
                <Link className={contentLinkClass} to={related.path}>
                  {related.name}
                </Link>
                {`: ${related.summary}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby={SOURCES_HEADING_ID} className={sectionClass}>
        <h2 id={SOURCES_HEADING_ID} className={sectionHeadingClass}>
          {sourcesHeading}
        </h2>
        <ul className={listClass}>
          {page.sources.map((source) => (
            <li key={source.href}>
              <a className={contentLinkClass} href={source.href}>
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      {children}
    </div>
  );
};
