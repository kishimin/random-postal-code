import { Link } from "@tanstack/react-router";
import { sourcesHeading } from "../../features/guides/guide-pages";
import type { GuidePage } from "../../features/guides/types";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { useMetaDescription } from "../../hooks/use-meta-description";
import { pageTitle } from "../site-text";
import { contentLinkClass } from "../styles";

const SOURCES_HEADING_ID = "guide-sources-heading";

const sectionClass = "flex flex-col gap-3 rounded-card bg-card p-6";
const sectionHeadingClass = "text-heading font-bold text-ink";
const paragraphClass = "text-body-sm text-ink-muted";
const listClass = "flex flex-col gap-2 pl-5 text-body-sm text-ink-muted";

type GuideViewProps = {
  page: GuidePage;
};

/**
 * One guide page (Issue #121, ui-design.md section 5.5): a lead, body sections
 * each a region named by its own visible h2, and the sources it relies on.
 *
 * Laid out like PrivacyView, which is also text on cards, and for the same
 * reason labelled the same way: aria-labelledby on the visible heading rather
 * than an invisible aria-label. It renders from the page's copy alone, so it
 * needs no generation and makes no request.
 */
export const GuideView = ({ page }: GuideViewProps) => {
  useDocumentTitle(pageTitle(page.name));
  useMetaDescription(page.description);

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
    </div>
  );
};
