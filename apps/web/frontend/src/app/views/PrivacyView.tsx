import { useDocumentTitle } from "../../hooks/use-document-title";
import { pageTitle, siteText } from "../site-text";
import { linkClass } from "../styles";
import { privacyText } from "./privacy-text";

const FIRST_PARTY_HEADING_ID = "privacy-first-party-heading";
const THIRD_PARTY_HEADING_ID = "privacy-third-party-heading";

const sectionClass = "flex flex-col gap-3 rounded-card bg-card p-6";
const sectionHeadingClass = "text-heading font-bold text-ink";
const paragraphClass = "text-body-sm text-ink-muted";

/**
 * Privacy screen (Issue #10).
 *
 * design.md section 8: "/privacy distinguishes data stored by Zipnami from
 * data processed by Google Maps, AdSense, and consent services." Two
 * `section`s carry that distinction to a screen reader as two separately
 * named regions, each labelled by its own visible heading (aria-labelledby)
 * rather than an invisible aria-label — the same pattern AdvertisingRegion
 * uses for its labelled region.
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

      <section
        aria-labelledby={FIRST_PARTY_HEADING_ID}
        className={sectionClass}
      >
        <h2 id={FIRST_PARTY_HEADING_ID} className={sectionHeadingClass}>
          {privacyText.firstParty.heading}
        </h2>
        <p className={paragraphClass}>
          {privacyText.firstParty.browserLocalHistory}
        </p>
        <p className={paragraphClass}>
          {privacyText.firstParty.noLocationCollection}
        </p>
        <p className={paragraphClass}>
          {privacyText.firstParty.noOwnUserIdentifier}
        </p>
        <p className={paragraphClass}>
          {privacyText.firstParty.noStoredAdvertisingIdentifier}
        </p>
      </section>

      <section
        aria-labelledby={THIRD_PARTY_HEADING_ID}
        className={sectionClass}
      >
        <h2 id={THIRD_PARTY_HEADING_ID} className={sectionHeadingClass}>
          {privacyText.thirdParty.heading}
        </h2>
        <p className={paragraphClass}>{privacyText.thirdParty.googleMaps}</p>
        <p className={paragraphClass}>{privacyText.thirdParty.googleAdSense}</p>
        <p className={paragraphClass}>
          {privacyText.thirdParty.googleAnalytics}
        </p>
        <p className={paragraphClass}>
          {privacyText.thirdParty.googleAnalyticsConsent}
        </p>
        <p className={paragraphClass}>
          {privacyText.thirdParty.googleAnalyticsOptOut}
        </p>
        <p className={paragraphClass}>{privacyText.thirdParty.consent}</p>
      </section>

      <p>
        <a
          className={`${linkClass} text-body-sm text-ink`}
          href={privacyText.contactHref}
        >
          {privacyText.contactLabel}
        </a>
      </p>
    </div>
  );
};
