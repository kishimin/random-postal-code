import { Link } from "@tanstack/react-router";
import {
  generatorOverview,
  learnMoreGuides,
} from "../../features/guides/generator-overview";
import { contentLinkClass } from "../styles";

const CAPABILITIES_HEADING_ID = "generator-capabilities-heading";
const LEARN_MORE_HEADING_ID = "generator-learn-more-heading";

const sectionClass = "flex flex-col gap-4 rounded-card bg-card p-6";
const sectionHeadingClass = "text-heading font-bold text-ink";

/**
 * The two sections that follow the generator's start card while no result is
 * shown (Issue #121, ui-design.md section 5.5): what Zipnami does, and the
 * guides that explain postal codes.
 *
 * Each is a region named by its own visible h2, the pattern PrivacyView and
 * AdvertisingRegion use. The capabilities are a list of titled items rather
 * than a run of headings, so the page's outline stays the h1 and these two.
 * GeneratorView mounts this only while there is no result, which keeps the
 * generate action where the result screen expects it.
 */
export const GeneratorOverview = () => (
  <div className={"mx-auto mt-12 flex max-w-[960px] flex-col gap-6 lg:mt-16"}>
    <section aria-labelledby={CAPABILITIES_HEADING_ID} className={sectionClass}>
      <h2 id={CAPABILITIES_HEADING_ID} className={sectionHeadingClass}>
        {generatorOverview.capabilitiesHeading}
      </h2>
      <ul className={"grid grid-cols-1 gap-4 lg:grid-cols-3"}>
        {generatorOverview.capabilities.map((capability) => (
          <li key={capability.title} className={"flex flex-col gap-1"}>
            <p className={"text-body-sm font-bold text-ink"}>
              {capability.title}
            </p>
            <p className={"text-body-sm text-ink-muted"}>{capability.body}</p>
          </li>
        ))}
      </ul>
    </section>

    <section aria-labelledby={LEARN_MORE_HEADING_ID} className={sectionClass}>
      <h2 id={LEARN_MORE_HEADING_ID} className={sectionHeadingClass}>
        {generatorOverview.learnMoreHeading}
      </h2>
      <ul className={"flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-6"}>
        {learnMoreGuides.map((guide) => (
          <li key={guide.path}>
            <Link className={contentLinkClass} to={guide.path}>
              {guide.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  </div>
);
