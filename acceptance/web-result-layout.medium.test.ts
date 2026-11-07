import type { Address, PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { respondWith } from "./pages/postal-code-generator-page.ts";
import {
  createResultLayoutPage,
  type ResultLayoutPage,
} from "./pages/result-layout-page.ts";
import { figmaCopy } from "./selectors/figma-copy.ts";

/*
 * Acceptance test for Issue #111: Match the desktop result layout to Figma
 * node 1:4.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * Held here, from the document and the accessibility tree:
 *
 *   - The eyebrow and the result headline are outside the result card and
 *     come before both the card and the map, at 1024px and wider and below.
 *   - The area line under the postal code follows the owner's component rule.
 *   - Each address reads as its text, then 地図に表示, then Google マップで開く,
 *     and both controls keep the address in their accessible names.
 *
 * Not held here, and deliberately so:
 *
 *   - Whether the map's top and bottom edges line up with the card's, and the
 *     1312px content width, 64px margins, and 560:720 split. The Issue says
 *     layout is verified by a person comparing screenshots with Figma, not by
 *     tests that read pixel values; a test that measured them would restate the
 *     stylesheet and pass whether or not the screen looks like Figma.
 *   - The contract update to docs/ui-design.md, which a browser cannot observe.
 *     It is settled by review of the change.
 *   - "The existing acceptance tests pass unchanged": that is the rest of this
 *     directory, run as it stands.
 *   - The area-line case of several addresses sharing prefecture, city, and
 *     town. Such addresses are identical, and design.md section 4.2 removes
 *     identical triples before a response is built, so no response can carry
 *     them. The rule's handling of that input is held by the frontend's own
 *     unit test of the function that builds the line.
 *
 * The Issue's Out of scope section is untouched: the copy action stays where
 * it is, and the header logo, the tablet and mobile frames, and the map
 * panel's label are not asserted.
 */

/**
 * Builds an address from its three fields.
 * @param prefecture - 都道府県.
 * @param city - 市区町村.
 * @param town - 町域.
 */
const address = (prefecture: string, city: string, town: string): Address => ({
  prefecture,
  city,
  town,
});

// Figma's own example (#2:24 and the address rows): three towns of one city.
const sharedCity: PostalCode = {
  postalCode: "9012223",
  addresses: [
    address("沖縄県", "宜野湾市", "大山1丁目"),
    address("沖縄県", "宜野湾市", "大山2丁目"),
    address("沖縄県", "宜野湾市", "大山3丁目"),
  ],
};

const singleAddress: PostalCode = {
  postalCode: "1000001",
  addresses: [address("東京都", "千代田区", "千代田")],
};

const noSharedPrefecture: PostalCode = {
  postalCode: "4980000",
  addresses: [
    address("愛知県", "弥富市", "鍋田町"),
    address("三重県", "桑名郡木曽岬町", "源緑輪中"),
  ],
};

const wideWidths = [1024, 1440] as const;
const narrowWidths = [390, 768] as const;

const test = shellTest.extend<{ resultLayoutPage: ResultLayoutPage }>({
  resultLayoutPage: async ({ page }, use) => {
    await use(createResultLayoutPage(page));
  },
});

/**
 * Shows the given result on the generator screen at the given width.
 * @param resultLayoutPage - The Page Object.
 * @param result - What `GET /api/random` answers.
 * @param width - The viewport width.
 */
const showResult = async (
  resultLayoutPage: ResultLayoutPage,
  result: PostalCode,
  width: number,
) => {
  await resultLayoutPage.isolateFromGoogle();
  await resultLayoutPage.stubRandomEndpoint([respondWith(result)]);
  await resultLayoutPage.useWidth(width);
  await resultLayoutPage.navigate();
  await resultLayoutPage.generate();
  await expect(
    resultLayoutPage.postalCodeDisplay(result.postalCode),
  ).toBeVisible();
};

test.describe("Issue #111: the desktop result layout", () => {
  for (const width of wideWidths) {
    test(`at ${width}px, TODAY'S DESTINATION and 波が運んできた場所 are outside the result card, above both the card and the map`, async ({
      resultLayoutPage,
    }) => {
      await showResult(resultLayoutPage, sharedCity, width);

      const { eyebrow, resultHeadline, resultCard, mapPanel } =
        resultLayoutPage;

      await expect(eyebrow()).toBeVisible();
      await expect(resultHeadline()).toBeVisible();
      await expect(mapPanel()).toBeVisible();

      // The card is the one Figma draws: the postal code, the addresses, and
      // もう一度、波に乗る are inside it.
      await expect(
        resultLayoutPage.postalCodeText(sharedCity.postalCode),
      ).toBeVisible();
      await expect(resultLayoutPage.addressEntries()).toHaveCount(
        sharedCity.addresses.length,
      );
      await expect(
        resultCard().getByRole("button", {
          name: figmaCopy.regenerateAction,
          exact: true,
        }),
      ).toBeVisible();

      expect(await resultLayoutPage.contains(resultCard(), eyebrow())).toBe(
        false,
      );
      expect(
        await resultLayoutPage.contains(resultCard(), resultHeadline()),
      ).toBe(false);
      expect(
        await resultLayoutPage.contains(mapPanel(), resultHeadline()),
      ).toBe(false);

      expect(await resultLayoutPage.precedes(eyebrow(), resultHeadline())).toBe(
        true,
      );
      expect(
        await resultLayoutPage.precedes(resultHeadline(), resultCard()),
      ).toBe(true);
      expect(
        await resultLayoutPage.precedes(resultHeadline(), mapPanel()),
      ).toBe(true);
    });
  }

  for (const width of narrowWidths) {
    test(`below 1024px (${width}px), TODAY'S DESTINATION and 波が運んできた場所 stay first in reading order, above the result`, async ({
      resultLayoutPage,
    }) => {
      await showResult(resultLayoutPage, sharedCity, width);

      const { eyebrow, resultHeadline, resultCard, mapPanel } =
        resultLayoutPage;

      await expect(eyebrow()).toBeVisible();
      // The phone frame draws no headline, so the heading may be visually
      // hidden there (approved on Issue #97); it is still the result's title.
      await expect(resultHeadline()).toHaveCount(1);

      expect(
        await resultLayoutPage.contains(resultCard(), resultHeadline()),
      ).toBe(false);
      expect(await resultLayoutPage.precedes(eyebrow(), resultHeadline())).toBe(
        true,
      );
      expect(
        await resultLayoutPage.precedes(resultHeadline(), resultCard()),
      ).toBe(true);
      expect(await resultLayoutPage.precedes(resultCard(), mapPanel())).toBe(
        true,
      );
    });
  }

  test("under the postal code, several addresses sharing only prefecture and city show the prefecture and the city", async ({
    resultLayoutPage,
  }) => {
    await showResult(resultLayoutPage, sharedCity, 1440);

    const areaLine = resultLayoutPage.textOutsideAddresses("沖縄県宜野湾市");
    await expect(areaLine).toBeVisible();
    // The town differs from address to address, so it is left out.
    await expect(
      resultLayoutPage.textOutsideAddresses("沖縄県宜野湾市大山"),
    ).toHaveCount(0);

    expect(
      await resultLayoutPage.precedes(
        resultLayoutPage.postalCodeText(sharedCity.postalCode),
        areaLine,
      ),
    ).toBe(true);
    expect(
      await resultLayoutPage.precedes(
        areaLine,
        resultLayoutPage.addressEntries().first(),
      ),
    ).toBe(true);
  });

  test("under the postal code, a single address shows that whole address", async ({
    resultLayoutPage,
  }) => {
    await showResult(resultLayoutPage, singleAddress, 1440);

    const areaLine =
      resultLayoutPage.textOutsideAddresses("東京都千代田区千代田");
    await expect(areaLine).toBeVisible();
    expect(
      await resultLayoutPage.precedes(
        resultLayoutPage.postalCodeText(singleAddress.postalCode),
        areaLine,
      ),
    ).toBe(true);
    expect(
      await resultLayoutPage.precedes(
        areaLine,
        resultLayoutPage.addressEntries().first(),
      ),
    ).toBe(true);
  });

  test("under the postal code, addresses that share no prefecture show no area line", async ({
    resultLayoutPage,
  }) => {
    await showResult(resultLayoutPage, noSharedPrefecture, 1440);

    // Every line the rule could have produced from any address.
    const candidates = noSharedPrefecture.addresses.flatMap(
      ({ prefecture, city, town }) => [
        prefecture,
        `${prefecture}${city}`,
        `${prefecture}${city}${town}`,
      ],
    );

    for (const candidate of candidates) {
      await expect(
        resultLayoutPage.textOutsideAddresses(candidate),
      ).toHaveCount(0);
    }
  });

  test("each address reads as its text, then 地図に表示, then Google マップで開く, and both controls carry the address in their names", async ({
    resultLayoutPage,
  }) => {
    await showResult(resultLayoutPage, sharedCity, 1440);

    const compact = (text: string) => text.replace(/\s+/g, "");

    for (const entry of sharedCity.addresses) {
      const text = await resultLayoutPage.entryText(entry);
      const addressAt = text.indexOf(
        compact(`${entry.prefecture}${entry.city}${entry.town}`),
      );
      const showOnMapAt = text.indexOf(compact(figmaCopy.showOnMap));
      const openInMapsAt = text.indexOf(compact(figmaCopy.openInGoogleMaps));

      expect(addressAt).toBe(0);
      expect(showOnMapAt).toBeGreaterThan(addressAt);
      expect(openInMapsAt).toBeGreaterThan(showOnMapAt);

      await expect(resultLayoutPage.mapSelectionAction(entry)).toBeVisible();
      await expect(resultLayoutPage.externalMapLink(entry)).toBeVisible();
      expect(
        await resultLayoutPage.precedes(
          resultLayoutPage.mapSelectionAction(entry),
          resultLayoutPage.externalMapLink(entry),
        ),
      ).toBe(true);
    }
  });
});
