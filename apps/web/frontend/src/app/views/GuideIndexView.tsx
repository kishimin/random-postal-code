import { Link } from "@tanstack/react-router";
import {
  guideCategories,
  guideIndexPage,
} from "../../features/guides/guide-pages";
import { guideIndexMetadata } from "../page-metadata";
import { siteText } from "../site-text";
import {
  contentLinkClass,
  guideListClass as listClass,
  guideParagraphClass as paragraphClass,
  guideSectionClass as sectionClass,
  guideSectionHeadingClass as sectionHeadingClass,
  primaryActionClass,
} from "../styles";
import { usePageHead } from "../use-page-head";

/**
 * The guide index (Issue #170, ui-design.md section 5.5): every guide under
 * its category, each category a region named by its own visible h2.
 *
 * Laid out like a guide page so the two read as one section of the site. It
 * states no facts of its own, so it has no sources; it ends with the same way
 * home every guide ends with.
 */
export const GuideIndexView = () => {
  usePageHead(guideIndexMetadata);

  return (
    <div className={"mx-auto flex max-w-[720px] flex-col gap-6"}>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5). */}
      <h1 tabIndex={-1} className={"text-headline font-bold text-ink"}>
        {guideIndexPage.name}
      </h1>
      <p className={paragraphClass}>{guideIndexPage.lead}</p>

      {guideCategories.map((category) => (
        <section
          key={category.headingId}
          aria-labelledby={category.headingId}
          className={sectionClass}
        >
          <h2 id={category.headingId} className={sectionHeadingClass}>
            {category.name}
          </h2>
          <p className={paragraphClass}>{category.description}</p>
          <ul className={listClass}>
            {category.pages.map((page) => (
              <li key={page.path}>
                <Link className={contentLinkClass} to={page.path}>
                  {page.name}
                </Link>
                {`: ${page.summary}`}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* The not-found screen's words and look, as on every guide. */}
      <Link className={`${primaryActionClass} self-center`} to={"/"}>
        {siteText.backToGenerator}
      </Link>
    </div>
  );
};
