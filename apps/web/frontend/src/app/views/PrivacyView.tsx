import { useDocumentTitle } from "../../hooks/use-document-title";
import { pageTitle, siteText } from "../site-text";
import { privacySections } from "./privacy-text";

const sectionClass = "flex flex-col gap-3 rounded-card bg-card p-6";
const sectionHeadingClass = "text-heading font-bold text-ink";
const paragraphClass = "text-body-sm text-ink-muted";

/**
 * Privacy screen (Issue #10, laid out as Figma's node 46:165 by Issue #97).
 *
 * design.md section 8 divides the page into Figma's four sections: each
 * `section` is a separately named region, labelled by its own
 * visible heading (aria-labelledby) rather than an invisible aria-label -- the
 * same pattern AdvertisingRegion uses for its labelled region.
 */
export const PrivacyView = () => {
  useDocumentTitle(pageTitle(siteText.privacyLabel));

  return (
    <div className={"mx-auto flex max-w-[720px] flex-col gap-6"}>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5), and a plain heading is not in the
          focusable area without one. */}
      <h1 tabIndex={-1} className={"text-headline font-bold text-ink"}>
        {siteText.privacyLabel}
      </h1>

      {privacySections.map((section) => (
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
        </section>
      ))}
    </div>
  );
};
