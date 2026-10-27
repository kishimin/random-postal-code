import type { Address, PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";
import {
  type AddressMapPage,
  createAddressMapPage,
} from "./pages/address-map-page.ts";
import { respondWith } from "./pages/postal-code-generator-page.ts";

/*
 * Acceptance test for Issue #8: Integrate Google Maps into the Web result
 * experience.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section — current-location access and an Android
 * embedded map — is deliberately untouched.
 *
 * Google is answered at the network boundary and never reached. design.md
 * section 7 makes Maps an optional dependency of the Web experience; a test
 * that let the requests out would measure Google's availability, its billing
 * state, and whichever key the build happened to carry, none of which is what
 * this Issue asks for.
 *
 * Four criteria are not held here.
 *
 * "Development and production use separate browser API keys" and "Production
 * keys have exact HTTP referrer restrictions and Maps Embed API-only
 * restrictions" describe the state of two Google Cloud projects. Neither key
 * exists in this repository, the production one exists nowhere this test can
 * reach, and design.md section 12 already assigns external key restrictions and
 * billing to a human comparing the configuration screens before release. A test
 * asserting them would have to invent the values it claims to check.
 *
 * "No unrestricted Maps key is committed to the repository" asks a test to prove
 * the absence of something it would first have to enumerate, and the
 * "unrestricted" half is not in the repository at all — a key's restrictions
 * live in Google Cloud, not beside the key. ADR-0019 settles this shape of
 * claim: do not prove an absent thing at runtime by re-implementing the forms it
 * could take. Repository-wide secret scanning is an operational job over all of
 * Git history, not one feature's acceptance test.
 *
 * "Tests cover selection, link generation, and graceful map failure" describes
 * which tests the repository contains, and a browser cannot observe that. The
 * behavior it enumerates is what this file exercises; where those tests live is
 * settled by the package's own suite and its coverage gate.
 *
 * One criterion is held in part. "Map loading, API-key, billing, and network
 * failures leave postal code, addresses, and history usable" is held for the
 * postal code and the addresses. Browser history is Issue #7's feature and does
 * not exist on this branch, so the history half is left to the Issue that owns
 * it rather than asserted against something unbuilt.
 */

/**
 * Finds a postal code in the shared acceptance dataset.
 * @param postalCode - The canonical seven-digit code to look up.
 */
const datasetEntry = (postalCode: string): PostalCode => {
  const entry = normalizedPostalCodes.find(
    (candidate) => candidate.postalCode === postalCode,
  );

  if (!entry) {
    throw new Error(`The acceptance dataset has no postal code ${postalCode}.`);
  }

  return entry;
};

/*
 * Two addresses that differ only by town, and by a town that is a real place
 * name rather than Japan Post's "no listing below" placeholder.
 *
 * Differing by one field makes "the map moved to the other address" a precise
 * observation: a map still showing the first address shares its prefecture and
 * city with the second, so only the town can carry the answer.
 */
const result = datasetEntry("3670030");
const [firstAddress, secondAddress] = result.addresses;

// A second result for the regeneration that has to keep working after a map
// failure. Nothing it carries overlaps the first, so a screen that failed to
// replace the earlier result still shows it.
const nextResult = datasetEntry("4980000");

/**
 * Whether a map query names every part of an address.
 * @param query - The decoded address query taken from a Google Maps URL.
 * @param address - The address the query is supposed to name.
 */
const namesFullAddress = (query: string, address: Address) =>
  query.includes(address.prefecture) &&
  query.includes(address.city) &&
  query.includes(address.town);

/*
 * Extends the shell fixture rather than editing it.
 *
 * ./fixtures/index.ts and ./fixtures/test.ts are committed, and the ATDD guard
 * locks a committed file under acceptance/ so an implementation cannot quietly
 * reshape the test it must satisfy. Adding a Page Object for a new Issue is not
 * that, but the guard cannot tell the two apart, so the fixture composes here.
 */
const test = shellTest.extend<{ addressMapPage: AddressMapPage }>({
  addressMapPage: async ({ page }, use) => {
    await use(createAddressMapPage(page));
  },
});

test.describe("Issue #8: Google Maps on the Web result", () => {
  test("every returned address offers a control that makes it the embedded map's target", async ({
    addressMapPage,
  }) => {
    await addressMapPage.stubMapEmbed("served");
    await addressMapPage.stubRandomEndpoint([respondWith(result)]);
    await addressMapPage.navigate();
    await addressMapPage.generate();

    for (const address of result.addresses) {
      await expect(addressMapPage.mapSelectionAction(address)).toBeVisible();
    }

    // One control per address, not one for the result: a screen offering a
    // single map action for the whole list satisfies every assertion above.
    await expect(addressMapPage.anyMapSelectionAction()).toHaveCount(
      result.addresses.length,
    );
  });

  test("the first address is the embedded map's target before any selection", async ({
    addressMapPage,
  }) => {
    await addressMapPage.stubMapEmbed("served");
    await addressMapPage.stubRandomEndpoint([respondWith(result)]);
    await addressMapPage.navigate();
    await addressMapPage.generate();

    await expect(
      addressMapPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();
    await addressMapPage.revealMap();

    await expect
      .poll(() => addressMapPage.currentEmbeddedAddress())
      .toContain(firstAddress.town);

    const requested = addressMapPage.currentEmbeddedAddress();
    expect(namesFullAddress(requested, firstAddress)).toBe(true);
    expect(requested).not.toContain(secondAddress.town);
  });

  test("selecting another address moves the embedded map to it", async ({
    addressMapPage,
  }) => {
    await addressMapPage.stubMapEmbed("served");
    await addressMapPage.stubRandomEndpoint([respondWith(result)]);
    await addressMapPage.navigate();
    await addressMapPage.generate();
    await addressMapPage.revealMap();

    await expect
      .poll(() => addressMapPage.currentEmbeddedAddress())
      .toContain(firstAddress.town);

    await addressMapPage.selectMapTarget(secondAddress);

    await expect
      .poll(() => addressMapPage.currentEmbeddedAddress())
      .toContain(secondAddress.town);

    const requested = addressMapPage.currentEmbeddedAddress();
    expect(namesFullAddress(requested, secondAddress)).toBe(true);
    expect(requested).not.toContain(firstAddress.town);

    // ui-design.md section 5.3: selecting another address changes the map
    // target and nothing else, so the result itself is still the same one.
    await expect(
      addressMapPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    for (const address of result.addresses) {
      await expect(addressMapPage.addressEntry(address)).toBeVisible();
    }
  });

  test("every address carries an external Google Maps link whose query encodes that address", async ({
    addressMapPage,
  }) => {
    await addressMapPage.stubMapEmbed("served");
    await addressMapPage.stubRandomEndpoint([respondWith(result)]);
    await addressMapPage.navigate();
    await addressMapPage.generate();

    for (const address of result.addresses) {
      await expect(addressMapPage.externalMapLink(address)).toBeVisible();

      const queries = await addressMapPage.externalMapAddresses(address);
      expect(queries.some((query) => namesFullAddress(query, address))).toBe(
        true,
      );

      // The criterion asks for an encoded query, and only the attribute as
      // written shows whether encoding happened: a link carrying the address
      // literally decodes to the same string as one that escaped it.
      const hrefs = await addressMapPage.externalMapLinkHrefs(address);
      expect(hrefs.some((href) => href.includes(address.town))).toBe(false);
    }
  });

  test("a map that cannot be reached leaves the postal code, its addresses, and regeneration usable", async ({
    addressMapPage,
  }) => {
    await addressMapPage.stubMapEmbed("unreachable");
    await addressMapPage.stubRandomEndpoint([
      respondWith(result),
      respondWith(nextResult),
    ]);
    await addressMapPage.navigate();
    await addressMapPage.generate();
    await addressMapPage.revealMap();

    // The map was attempted and failed, rather than never attempted: without
    // this the rest of the test would pass on a build that has no map at all.
    await expect
      .poll(() => addressMapPage.mapRequestCount())
      .toBeGreaterThan(0);

    await expect(
      addressMapPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    for (const address of result.addresses) {
      await expect(addressMapPage.addressEntry(address)).toBeVisible();
      await expect(addressMapPage.externalMapLink(address)).toBeVisible();
    }

    await addressMapPage.generate();

    await expect(
      addressMapPage.postalCodeDisplay(nextResult.postalCode),
    ).toBeVisible();

    for (const address of nextResult.addresses) {
      await expect(addressMapPage.addressEntry(address)).toBeVisible();
    }
  });

  test("a map request Google refuses leaves the postal code, its addresses, and regeneration usable", async ({
    addressMapPage,
  }) => {
    /*
     * `rejected` answers every map request with 403, which is what an
     * unauthorized, referrer-restricted, or unbilled key produces before any
     * map is drawn. When Google instead renders its own error inside the frame,
     * that document is cross-origin: neither the page nor this test can read
     * it, so what is held here is the boundary — the result never depends on
     * how the map turned out — rather than Google's wording.
     */
    await addressMapPage.stubMapEmbed("rejected");
    await addressMapPage.stubRandomEndpoint([
      respondWith(result),
      respondWith(nextResult),
    ]);
    await addressMapPage.navigate();
    await addressMapPage.generate();
    await addressMapPage.revealMap();

    await expect
      .poll(() => addressMapPage.mapRequestCount())
      .toBeGreaterThan(0);

    await expect(
      addressMapPage.postalCodeDisplay(result.postalCode),
    ).toBeVisible();

    for (const address of result.addresses) {
      await expect(addressMapPage.addressEntry(address)).toBeVisible();
      await expect(addressMapPage.externalMapLink(address)).toBeVisible();
    }

    await addressMapPage.generate();

    await expect(
      addressMapPage.postalCodeDisplay(nextResult.postalCode),
    ).toBeVisible();

    for (const address of nextResult.addresses) {
      await expect(addressMapPage.addressEntry(address)).toBeVisible();
    }
  });
});
