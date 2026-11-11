import { Link } from "@tanstack/react-router";
import { aboutPage } from "../../features/guides/about-page";
import { addressPage } from "../../features/guides/address-page";
import { dataPage } from "../../features/guides/data-page";
import { howToUsePage } from "../../features/guides/how-to-use-page";
import { postalCodePage } from "../../features/guides/postal-code-page";
import type { GuidePage } from "../../features/guides/types";
import { siteText } from "../site-text";
import { primaryActionClass } from "../styles";
import { GuideView } from "./GuideView";

type GuideRouteProps = {
  page: GuidePage;
};

/**
 * A guide page as its route shows it: the page, ended by a link back to the
 * generator (ui-design.md section 5.5). The header logo was the only way home
 * from a guide page, and the owner chose a link at the end of the article
 * rather than in the header or the footer (Issue #121, 2026-11-11).
 *
 * The link is passed to GuideView rather than written into it: a Link needs
 * the router, and GuideView's structure is tested without one.
 */
const GuideRoute = ({ page }: GuideRouteProps) => (
  <GuideView page={page}>
    {/* The not-found screen's words and look, so the way home reads the
        same wherever a visitor meets it. */}
    <Link className={`${primaryActionClass} self-center`} to={"/"}>
      {siteText.backToGenerator}
    </Link>
  </GuideView>
);

/*
 * One component per route, because a TanStack route takes a component rather
 * than props. Each one only chooses which page's copy GuideRoute renders, so a
 * route and its page stay named together here instead of being matched by a
 * lookup that could silently miss.
 */

/** The /about route's screen. */
export const AboutView = () => <GuideRoute page={aboutPage} />;

/** The /guide/postal-code route's screen. */
export const PostalCodeGuideView = () => <GuideRoute page={postalCodePage} />;

/** The /guide/address route's screen. */
export const AddressGuideView = () => <GuideRoute page={addressPage} />;

/** The /guide/data route's screen. */
export const DataGuideView = () => <GuideRoute page={dataPage} />;

/** The /guide/how-to-use route's screen. */
export const HowToUseGuideView = () => <GuideRoute page={howToUsePage} />;
