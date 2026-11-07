import type { Locator, Page } from "@playwright/test";
import type { Address } from "@zipnami/shared";
import { applicationCopy, figmaCopy } from "../selectors/figma-copy.ts";
import { displayedPostalCode } from "../selectors/generator-selectors.ts";
import { createAddressMapPage } from "./address-map-page.ts";
import { createAdvertisingPage } from "./advertising-page.ts";

/** Figma's eyebrow above the result headline (#2:19, Web / Desktop / Result). */
export const resultEyebrow = "TODAY'S DESTINATION";

/**
 * Page Object for how the result screen is put together (Issue #111): where
 * the eyebrow and the headline sit relative to the result card and the map,
 * the area line under the postal code, and the order inside each address.
 *
 * Everything here is read from the document and the accessibility tree:
 * containment and reading order. How wide or how tall anything is drawn is
 * left to the human comparison with Figma that Issue #111 names, because a
 * test that read pixel values would only restate the stylesheet.
 *
 * Composes the map and advertising Page Objects so Google is answered at the
 * network boundary and never reached.
 * @param page - The Playwright page driving the browser.
 */
export const createResultLayoutPage = (page: Page) => {
  const maps = createAddressMapPage(page);
  const advertising = createAdvertisingPage(page);

  /**
   * Answers every third-party request this screen makes. Call before
   * navigating.
   */
  const isolateFromGoogle = async () => {
    await advertising.failEveryAdvertisingRequest();
    await maps.stubMapEmbed("served");
  };

  /**
   * Sets the viewport width; the height stays a common laptop height.
   * @param width - The CSS width in pixels.
   */
  const useWidth = (width: number) =>
    page.setViewportSize({ width, height: 900 });

  const main = () => page.getByRole("main");

  // The result card is the region the result headline names: it holds the
  // postal code, the addresses, and the action that generates again.
  const resultCard = () =>
    page.getByRole("region", { name: figmaCopy.resultHeading, exact: true });

  const resultHeadline = () =>
    page.getByRole("heading", { name: figmaCopy.resultHeading, exact: true });

  const eyebrow = () => main().getByText(resultEyebrow, { exact: true });

  const mapPanel = () =>
    page.getByRole("region", {
      name: applicationCopy.mapHeading,
      exact: true,
    });

  const postalCodeText = (postalCode: string) =>
    resultCard().getByText(displayedPostalCode(postalCode), { exact: true });

  /*
   * Text in the result card that is exactly this, and not part of an address
   * entry. An address entry is excluded because with one address the area
   * line and the address read the same.
   */
  const textOutsideAddresses = (text: string) =>
    resultCard()
      .getByText(text, { exact: true })
      .and(page.locator("xpath=//*[not(ancestor-or-self::li)]"));

  const addressEntries = () => resultCard().getByRole("listitem");

  /**
   * Whether `first` comes before `second` in the document, which is the
   * order a screen reader and the Tab key follow.
   * @param first - The element expected first.
   * @param second - The element expected after it.
   */
  const precedes = async (first: Locator, second: Locator) => {
    const other = await second.elementHandle();
    return first.evaluate(
      (element, target) =>
        target !== null &&
        (element.compareDocumentPosition(target) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
      other,
    );
  };

  /**
   * Whether `outer` contains `inner`.
   * @param outer - The possible ancestor.
   * @param inner - The possible descendant.
   */
  const contains = async (outer: Locator, inner: Locator) => {
    const target = await inner.elementHandle();
    return outer.evaluate(
      (element, candidate) => candidate !== null && element.contains(candidate),
      target,
    );
  };

  /**
   * The text of one address entry, in reading order, with white space
   * removed so a line break the layout adds does not count.
   * @param address - The address whose entry to read.
   */
  const entryText = async (address: Address) =>
    (await maps.addressEntry(address).innerText()).replace(/\s+/g, "");

  return {
    ...maps,
    isolateFromGoogle,
    useWidth,
    resultCard,
    resultHeadline,
    eyebrow,
    mapPanel,
    postalCodeText,
    textOutsideAddresses,
    addressEntries,
    precedes,
    contains,
    entryText,
  };
};

export type ResultLayoutPage = ReturnType<typeof createResultLayoutPage>;
