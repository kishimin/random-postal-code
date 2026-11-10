import { aboutPage } from "../../features/guides/about-page";
import { addressPage } from "../../features/guides/address-page";
import { dataPage } from "../../features/guides/data-page";
import { howToUsePage } from "../../features/guides/how-to-use-page";
import { postalCodePage } from "../../features/guides/postal-code-page";
import { GuideView } from "./GuideView";

/*
 * One component per route, because a TanStack route takes a component rather
 * than props. Each one only chooses which page's copy GuideView renders, so a
 * route and its page stay named together here instead of being matched by a
 * lookup that could silently miss.
 */
export const AboutView = () => <GuideView page={aboutPage} />;

export const PostalCodeGuideView = () => <GuideView page={postalCodePage} />;

export const AddressGuideView = () => <GuideView page={addressPage} />;

export const DataGuideView = () => <GuideView page={dataPage} />;

export const HowToUseGuideView = () => <GuideView page={howToUsePage} />;
