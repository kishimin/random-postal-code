import type { Address } from "@zipnami/shared";

type AddressListProps = {
  addresses: readonly Address[];
};

/**
 * Every address the current result carries, in source order (ui-design.md
 * section 5.3: "Render every address in source order; do not collapse
 * multiple addresses into a summary."). A native `<ul>`/`<li>` pair is used
 * instead of an ARIA list role so assistive technology gets list semantics
 * for free (ui-design.md section 8).
 */
export const AddressList = ({ addresses }: AddressListProps) => (
  <ul>
    {addresses.map((address, index) => (
      <li
        key={`${index}-${address.prefecture}-${address.city}-${address.town}`}
      >
        {`${address.prefecture}${address.city}${address.town}`}
      </li>
    ))}
  </ul>
);
