import type { PostalCode } from "@zipnami/shared";

/*
 * Generations for the Issue #7 acceptance test, where what matters is how many
 * results a visitor has produced and in which order.
 *
 * ./postal-code-dataset.ts holds five postal codes, chosen so that each one
 * makes a particular Issue #3 or Issue #4 criterion fail loudly. Overflowing a
 * twenty-entry history needs twenty-one generations that stay distinguishable
 * from one another after the twenty-first arrives, which is a different
 * requirement, and reusing those five would make "the oldest entry was
 * removed" indistinguishable from "an identical entry is still on screen".
 *
 * The values below are deliberately not real Japan Post records. The endpoint
 * is stubbed, so nothing here has to exist; what each entry has to be is
 * unmistakable, which a real record sharing a prefecture with twenty others
 * would not be.
 */

/**
 * One generation, distinguishable from every other by its ordinal.
 * @param ordinal - The position in the sequence, from 1.
 */
const distinctGeneration = (ordinal: number): PostalCode => {
  const sequence = String(ordinal).padStart(4, "0");

  return {
    // Seven digits, as api-design.md section 3 requires, displayed as
    // 900-0001 through 900-0021.
    postalCode: `900${sequence}`,
    addresses: [
      {
        prefecture: `第${sequence}県`,
        city: `第${sequence}市`,
        town: `第${sequence}町`,
      },
    ],
  };
};

/**
 * Twenty-one generations, one more than design.md section 6.2's retention
 * limit, in the order a visitor would produce them.
 *
 * Twenty-one rather than a round number: the limit is crossed by exactly one
 * entry, so the test distinguishes "the oldest was removed" from "the history
 * was truncated to something at most twenty".
 */
export const overflowGenerations: readonly PostalCode[] = Array.from(
  { length: 21 },
  (_, index) => distinctGeneration(index + 1),
);

/** The first generation in {@link overflowGenerations}, the one evicted. */
export const oldestOverflowPostalCode = "9000001";

/** The last generation in {@link overflowGenerations}, the one that evicts. */
export const newestOverflowPostalCode = "9000021";
