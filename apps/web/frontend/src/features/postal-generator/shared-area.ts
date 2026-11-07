import type { Address, PostalCode } from "@zipnami/shared";

// Coarsest first: a component is only meaningful under the ones before it.
const components = [
  "prefecture",
  "city",
  "town",
] as const satisfies readonly (keyof Address)[];

/**
 * The area line under the postal code (ui-design.md section 9.2, owner
 * decision on Issue #111): the leading address components every address
 * shares, joined.
 *
 * Compared component by component rather than as a common string prefix,
 * which would cut `大山1丁目` and `大山2丁目` down to `大山` -- the owner chose
 * whole components over cut town names.
 * @param addresses - Every address of the postal code, in source order.
 * @returns The joined components, or `undefined` when none is shared.
 */
export const sharedArea = ([first, ...rest]: PostalCode["addresses"]):
  string | undefined => {
  const shared: string[] = [];

  for (const component of components) {
    if (rest.some((address) => address[component] !== first[component])) {
      break;
    }
    shared.push(first[component]);
  }

  const line = shared.join("");
  return line === "" ? undefined : line;
};
