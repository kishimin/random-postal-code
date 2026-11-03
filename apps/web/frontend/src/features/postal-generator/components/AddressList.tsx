import type { Address } from "@zipnami/shared";
import type { ReactNode } from "react";

type AddressListProps = {
  addresses: readonly Address[];
  /**
   * Extra content rendered inside each address's own entry, after its text
   * -- Issue #8's per-address map action, for example. AddressList accepts
   * it rather than importing anything about maps, so features/postal-generator
   * stays free of a features/maps dependency (the app composes the two).
   */
  renderAddressExtra?: (address: Address) => ReactNode;
  /**
   * The address the map currently shows. It is drawn on the accent surface
   * (Figma's first "Address" card); the map action's pressed state, not this
   * color, is what tells assistive technology which one it is.
   */
  selectedAddress?: Address;
};

/**
 * Every address the current result carries, in source order (ui-design.md
 * section 5.3: "Render every address in source order; do not collapse
 * multiple addresses into a summary."). A native `<ul>`/`<li>` pair is used
 * instead of an ARIA list role so assistive technology gets list semantics
 * for free (ui-design.md section 8).
 */
export const AddressList = ({
  addresses,
  renderAddressExtra,
  selectedAddress,
}: AddressListProps) => (
  <ul className={"mt-4 flex flex-col gap-3"}>
    {addresses.map((address) => (
      // design.md section 4.2 dedupes identical prefecture/city/town triples
      // before this ever renders, so the triple itself is already a unique key.
      <li
        key={`${address.prefecture}-${address.city}-${address.town}`}
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-field border border-card-border px-4 py-2 text-body-sm font-semibold text-ink ${address === selectedAddress ? "bg-accent-surface" : "bg-card"}`}
      >
        {`${address.prefecture}${address.city}${address.town}`}
        {renderAddressExtra?.(address)}
      </li>
    ))}
  </ul>
);
