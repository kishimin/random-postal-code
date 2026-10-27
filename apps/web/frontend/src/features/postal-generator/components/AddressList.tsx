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
}: AddressListProps) => (
  <ul>
    {addresses.map((address) => (
      // design.md section 4.2 dedupes identical prefecture/city/town triples
      // before this ever renders, so the triple itself is already a unique key.
      <li key={`${address.prefecture}-${address.city}-${address.town}`}>
        {`${address.prefecture}${address.city}${address.town}`}
        {renderAddressExtra?.(address)}
      </li>
    ))}
  </ul>
);
