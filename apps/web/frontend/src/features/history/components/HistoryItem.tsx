import type { Address, PostalCode } from "@zipnami/shared";

type HistoryItemProps = {
  entry: PostalCode;
};

// Mirrors postal-generator/format-postal-code.ts rather than importing it:
// the boundaries lint rule keeps features/<feature> from depending on
// another feature (see postal-generator/styles.ts for the same trade-off).
const displayPostalCode = (postalCode: string) =>
  `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;

const addressText = (address: Address) =>
  `${address.prefecture}${address.city}${address.town}`;

/**
 * One entry in the opened Web generation history (ui-design.md sections 5.4
 * and 9.2): its postal code and every address that code covers. The entry has
 * no control of its own; the list is opened as a whole by HistoryList.
 */
export const HistoryItem = ({ entry }: HistoryItemProps) => (
  <li
    className={
      "rounded-field border border-card-border bg-card px-4 py-3 text-body-sm text-ink"
    }
  >
    <p className={"text-body font-bold tabular-nums"}>
      {displayPostalCode(entry.postalCode)}
    </p>
    <ul className={"mt-2 flex flex-col gap-1 text-ink-muted"}>
      {entry.addresses.map((address) => (
        <li key={`${address.prefecture}-${address.city}-${address.town}`}>
          {addressText(address)}
        </li>
      ))}
    </ul>
  </li>
);
