import type { Address } from "@zipnami/shared";
import type { GeneratedPostalCode } from "../pages/production-site-page.ts";
import { privacyStatements } from "../selectors/production-selectors.ts";
import { expect, test } from "./fixtures.ts";

/*
 * Issue #104: the production happy path, as one journey on the deployed site.
 *
 * Large, because it runs against real Cloudflare and real Google: the Pages
 * site the Deploy workflow just published, the Worker it calls, and the Maps
 * embed with the production key. Only what needs the deployed site is here.
 * Error paths, edge cases, layout, and accessibility stay in the Small and
 * Medium tests, and the local stack is covered by
 * acceptance/web-mvp-end-to-end.large.test.ts.
 *
 * Nothing is stubbed except the advertising, consent, and Analytics hosts,
 * which the fixture aborts before the first navigation.
 */

/**
 * The full address text, as the site names it in a map query.
 * @param {Address} address - One address of the result.
 */
const fullAddress = (address: Address) =>
  `${address.prefecture}${address.city}${address.town}`;

/**
 * Whether a Google Maps link asks for exactly this address, with the query
 * encoded rather than written out literally.
 * @param {string} href - The link's `href` as written.
 * @param {Address} address - The address it must open.
 */
const opensEncoded = (href: string, address: Address) => {
  const { searchParams } = new URL(href);
  const query = searchParams.get("query") ?? searchParams.get("q");

  return query === fullAddress(address) && !href.includes(address.prefecture);
};

test.describe("Issue #104: the Web MVP on the deployed site", () => {
  test("a generation shows the Worker's result, embeds the map, links each address to Google Maps, copies, survives a reload, and /privacy opens", async ({
    sitePage,
  }) => {
    await sitePage.navigate();

    const answer = await sitePage.generateThroughWorker();

    // A CORS refusal or a Worker failure shows up here first.
    expect(answer.status).toBe(200);
    // The page called the Worker, not a Pages path ending in /api/random.
    expect(answer.apiOrigin).not.toBe(answer.pageOrigin);

    expect(answer.body?.postalCode).toMatch(/^\d{7}$/);
    const generated = answer.body as GeneratedPostalCode;
    expect(generated.addresses.length).toBeGreaterThan(0);

    // Every address the Worker returned, each with a Google Maps link whose
    // query is that address.
    await expect(
      sitePage.postalCodeDisplay(generated.postalCode),
    ).toBeVisible();
    for (const address of generated.addresses) {
      await expect(sitePage.resultAddressEntry(address)).toBeVisible();

      const hrefs = await sitePage.externalMapHrefs(address);
      expect({
        address: fullAddress(address),
        opensIt: hrefs.some((href) => opensEncoded(href, address)),
      }).toEqual({ address: fullAddress(address), opensIt: true });
    }

    // The production key reaches the embed: a frame asking for the first
    // address, still there once it has loaded, not the fallback link.
    await sitePage.revealMap();
    await expect(sitePage.mapEmbed()).toBeVisible();
    const embed = new URL((await sitePage.mapEmbedSource()) ?? "");
    expect(embed.searchParams.get("key")).toMatch(/\S/);
    expect(embed.searchParams.get("q")).toBe(
      fullAddress(generated.addresses[0]),
    );
    await sitePage.waitForMapEmbedToLoad();
    await expect(sitePage.mapEmbed()).toBeVisible();

    // The canonical seven digits, not the hyphenated form on screen.
    await sitePage.copy();
    await expect
      .poll(() => sitePage.clipboardText())
      .toBe(generated.postalCode);

    // A fresh browser starts with no history, so after a reload it holds
    // exactly this generation.
    await sitePage.reload();
    await expect
      .poll(() => sitePage.historyPostalCodes())
      .toEqual([generated.postalCode]);

    await sitePage.openPrivacy();
    await expect(sitePage.privacyHeading()).toBeVisible();
    for (const statement of Object.values(privacyStatements)) {
      await expect(sitePage.privacyStatement(statement)).toBeVisible();
    }
  });

  test("a direct visit to /privacy and a refresh of it both answer 200 and show the privacy page", async ({
    sitePage,
  }) => {
    const direct = await sitePage.navigateToPrivacy();

    expect(direct?.status()).toBe(200);
    await expect(sitePage.privacyHeading()).toBeVisible();

    const refreshed = await sitePage.reload();

    expect(refreshed?.status()).toBe(200);
    await expect(sitePage.privacyHeading()).toBeVisible();
  });
});
