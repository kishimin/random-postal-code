import type { PostalCode } from "@zipnami/shared";
import { expect, test as shellTest } from "./fixtures";
import {
  newestOverflowPostalCode,
  oldestOverflowPostalCode,
  overflowGenerations,
} from "./fixtures/history-generations.ts";
import {
  eightAddressPostalCode,
  normalizedPostalCodes,
  unevenlySizedPostalCodes,
} from "./fixtures/postal-code-dataset.ts";
import {
  createGenerationHistoryPage,
  type GenerationHistoryPage,
} from "./pages/generation-history-page.ts";

/*
 * Acceptance test for Issue #7: Persist and display the Web generation history.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * The Issue's Out of scope section -- accounts, cross-device synchronization,
 * and favorites -- is deliberately untouched, as is the map (Issue #8):
 * ui-design.md section 5.4 requires expanding an entry to leave the current map
 * selection alone, and there is no map yet for that to be observable against.
 *
 * Two criteria are not held here.
 *
 * "Corrupt or unsupported stored data is handled without preventing new
 * generation" describes what happens when the browser's persisted history
 * cannot be read back. A visitor cannot produce that state, so a test has to
 * seed it, and seeding it means writing to the storage slot the implementation
 * reads -- its adapter and version key. design.md section 12 assigns "Web
 * history keys and migration" to this Issue's own Red/Green cycles and says it
 * "must not be guessed from this document alone", and ui-design.md section 12
 * lists "browser persistence adapters and version keys" as unresolved. An
 * acceptance test that named a key would either dictate that decision or, if it
 * guessed wrong, corrupt nothing and pass while proving nothing. ui-design.md
 * section 11 already places "storage validation" in the Small tests, which is
 * where the implementation can seed the state it defines. The inner loop owes
 * this criterion a test covering a value that is not valid JSON, a well-formed
 * value of an unsupported shape or version, and, in each case, that generating
 * afterwards still works.
 *
 * "Tests cover ordering, limit enforcement, duplicate retention, persistence,
 * and invalid stored state" describes which tests the repository contains, and
 * a browser cannot observe that. Everything it enumerates except invalid stored
 * state is what this file exercises.
 *
 * The endpoint is stubbed at the network boundary, as in Issue #6: a real
 * service returns an unknown postal code, and every criterion below is about
 * which known ones end up in history and in what order.
 */

/**
 * Finds a postal code in one of the acceptance fixtures.
 * @param collection - The fixture collection to look in.
 * @param postalCode - The canonical seven-digit code to look up.
 */
const entryFrom = (
  collection: readonly PostalCode[],
  postalCode: string,
): PostalCode => {
  const entry = collection.find(
    (candidate) => candidate.postalCode === postalCode,
  );

  if (!entry) {
    throw new Error(
      `The acceptance fixtures have no postal code ${postalCode}.`,
    );
  }

  return entry;
};

// Neither code nor address overlaps the other, so an entry that should have
// been replaced or reordered is visible rather than mistakable for the other.
const firstResult = entryFrom(normalizedPostalCodes, "3670030");
const secondResult = entryFrom(normalizedPostalCodes, "4980000");

/*
 * Eight addresses, every one in the same city and differing only by town.
 *
 * "Each history entry preserves the postal code and all associated addresses"
 * is a shape check against a two-address result and a real requirement against
 * this one: an entry that kept only the primary address is short by seven towns
 * rather than by one.
 */
const manyAddressResult = entryFrom(
  unevenlySizedPostalCodes,
  eightAddressPostalCode,
);

const newestGeneration = entryFrom(
  overflowGenerations,
  newestOverflowPostalCode,
);
const oldestGeneration = entryFrom(
  overflowGenerations,
  oldestOverflowPostalCode,
);

/*
 * Extends the shell fixture rather than editing it.
 *
 * ./fixtures/index.ts and ./fixtures/test.ts are committed, and the ATDD guard
 * locks a committed file under acceptance/ so an implementation cannot quietly
 * reshape the test it must satisfy. Adding a Page Object for a new Issue is not
 * that, but the guard cannot tell the two apart, so the fixture composes here.
 */
const test = shellTest.extend<{
  generationHistoryPage: GenerationHistoryPage;
}>({
  generationHistoryPage: async ({ page }, use) => {
    await use(createGenerationHistoryPage(page));
  },
});

test.describe("Issue #7: the Web generation history", () => {
  test("each successful generation is added to the beginning of history", async ({
    generationHistoryPage,
  }) => {
    await generationHistoryPage.stubGenerations([firstResult, secondResult]);
    await generationHistoryPage.navigate();

    // Nothing has been generated, so there is nothing to have a history of.
    await expect(generationHistoryPage.historyEntries()).toHaveCount(0);

    await generationHistoryPage.generate(firstResult.postalCode);

    // ui-design.md section 8: the history region carries its own heading.
    await expect(generationHistoryPage.historyHeading()).toBeVisible();
    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual([firstResult.postalCode]);

    await generationHistoryPage.generate(secondResult.postalCode);

    // Prepended, not appended: design.md section 6.2 stores history newest
    // first, so the second generation is read before the first.
    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual([secondResult.postalCode, firstResult.postalCode]);
  });

  test("history stops at twenty entries, and the twenty-first generation removes the oldest", async ({
    generationHistoryPage,
  }) => {
    await generationHistoryPage.stubGenerations(overflowGenerations);
    await generationHistoryPage.navigate();
    await generationHistoryPage.generateAll(overflowGenerations.slice(0, 20));

    // design.md section 6.2: at most twenty entries. Twenty generations reach
    // the limit without crossing it, so nothing has been dropped yet.
    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual(
        overflowGenerations
          .slice(0, 20)
          .map((generation) => generation.postalCode)
          .reverse(),
      );

    await generationHistoryPage.generate(newestGeneration.postalCode);

    // Adding entry 21 removes the oldest entry, and only the oldest: the
    // twenty that remain are generations 2 through 21, newest first.
    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual(
        overflowGenerations
          .slice(1)
          .map((generation) => generation.postalCode)
          .reverse(),
      );

    await expect(generationHistoryPage.historyEntries()).toHaveCount(20);

    // The evicted entry is gone in full, address and all, rather than reduced
    // to a postal code the list still carries somewhere.
    await expect(
      generationHistoryPage.historyEntryShowing(oldestGeneration.addresses[0]),
    ).toHaveCount(0);
  });

  test("the same postal code generated twice stays as two separate entries", async ({
    generationHistoryPage,
  }) => {
    await generationHistoryPage.stubGenerations([firstResult, firstResult]);
    await generationHistoryPage.navigate();
    await generationHistoryPage.generate(firstResult.postalCode);
    await generationHistoryPage.generate(firstResult.postalCode);

    // design.md section 6.2 retains duplicates: the second occurrence is a
    // separate chronological entry, not an update of the first.
    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual([firstResult.postalCode, firstResult.postalCode]);
  });

  test("a history entry keeps the postal code and every address of that generation", async ({
    generationHistoryPage,
  }) => {
    await generationHistoryPage.stubGenerations([manyAddressResult]);
    await generationHistoryPage.navigate();
    await generationHistoryPage.generate(manyAddressResult.postalCode);

    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual([manyAddressResult.postalCode]);

    // ui-design.md section 5.4 allows an entry to start collapsed as long as
    // every address stays reachable through an explicit expand control, so the
    // addresses are asked for before they are required.
    await generationHistoryPage.revealEveryAddress();

    for (const address of manyAddressResult.addresses) {
      await expect(
        generationHistoryPage.historyEntryShowing(address),
      ).toHaveCount(1);
    }
  });

  test("history is still there, in the same order, after the browser reloads", async ({
    generationHistoryPage,
  }) => {
    await generationHistoryPage.stubGenerations([firstResult, secondResult]);
    await generationHistoryPage.navigate();
    await generationHistoryPage.generate(firstResult.postalCode);
    await generationHistoryPage.generate(secondResult.postalCode);

    await generationHistoryPage.reload();

    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual([secondResult.postalCode, firstResult.postalCode]);

    // A restored entry carries what it carried before the reload, not just a
    // postal code: design.md section 6.2 stores the addresses with it.
    await generationHistoryPage.revealEveryAddress();

    for (const address of secondResult.addresses) {
      await expect(
        generationHistoryPage.historyEntryShowing(address),
      ).toHaveCount(1);
    }
  });

  test("no request carries history to the backend, and restoring it asks the backend for nothing", async ({
    generationHistoryPage,
  }) => {
    generationHistoryPage.recordBackendCalls();
    await generationHistoryPage.stubGenerations([firstResult, secondResult]);
    await generationHistoryPage.navigate();
    await generationHistoryPage.generate(firstResult.postalCode);
    await generationHistoryPage.generate(secondResult.postalCode);

    const callsAfterGenerating = generationHistoryPage.backendCallCount();

    await generationHistoryPage.reload();

    await expect
      .poll(() => generationHistoryPage.historyPostalCodes())
      .toEqual([secondResult.postalCode, firstResult.postalCode]);

    // History came back from the browser. Had the backend held it, restoring
    // two entries would have taken at least one request to fetch them.
    expect(generationHistoryPage.backendCallCount()).toBe(callsAfterGenerating);

    // And nothing the page sent could have carried history there: every call
    // was the read-only generation request, with no body and no postal code
    // riding along in the query.
    for (const call of generationHistoryPage.backendCalls()) {
      expect(["GET", "OPTIONS"]).toContain(call.method);
      expect(call.path).toBe("/api/random");
      expect(call.body).toBeNull();
      expect(call.query).not.toContain(firstResult.postalCode);
      expect(call.query).not.toContain(secondResult.postalCode);
    }
  });
});
