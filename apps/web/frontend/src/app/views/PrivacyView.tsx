import { useDocumentTitle } from "../../hooks/use-document-title";
import { pageTitle, siteText } from "../site-text";
import { linkClass } from "../styles";
import { privacyText } from "./privacy-text";

const FIRST_PARTY_HEADING_ID = "privacy-first-party-heading";
const THIRD_PARTY_HEADING_ID = "privacy-third-party-heading";

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
    <>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5), and a plain heading is not in the
          focusable area without one. */}
      <h1 tabIndex={-1}>{siteText.privacyLabel}</h1>

      <section aria-labelledby={FIRST_PARTY_HEADING_ID}>
        <h2 id={FIRST_PARTY_HEADING_ID}>{privacyText.firstParty.heading}</h2>
        <p>{privacyText.firstParty.browserLocalHistory}</p>
        <p>{privacyText.firstParty.noLocationCollection}</p>
        <p>{privacyText.firstParty.noOwnUserIdentifier}</p>
        <p>{privacyText.firstParty.noStoredAdvertisingIdentifier}</p>
      </section>

      <section aria-labelledby={THIRD_PARTY_HEADING_ID}>
        <h2 id={THIRD_PARTY_HEADING_ID}>{privacyText.thirdParty.heading}</h2>
        <p>{privacyText.thirdParty.googleMaps}</p>
        <p>{privacyText.thirdParty.googleAdSense}</p>
        <p>{privacyText.thirdParty.consent}</p>
      </section>

      <p>
        <a className={linkClass} href={privacyText.contactHref}>
          {privacyText.contactLabel}
        </a>
      </p>
    </>
  );
};
