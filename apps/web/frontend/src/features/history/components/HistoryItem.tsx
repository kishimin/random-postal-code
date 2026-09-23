import type { Address, PostalCode } from "@zipnami/shared";
import { useState } from "react";
import { historyText } from "../site-text";

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
 * One entry in the Web generation history (ui-design.md section 5.4): its
 * postal code, always visible, and its addresses behind an explicit expand
 * control.
 *
 * Every address is collapsed by default, not only the ones past the first --
 * a design choice, not the letter of ui-design.md section 5.4, needed so a
 * superseded generation's address never sits in the page unless a visitor
 * asks for it. random-postal-code-experience.medium.test.ts (Issue #6) polls
 * the whole page for a superseded result's address to be gone once a new one
 * replaces it; a history that showed an old entry's primary address by
 * default would leave that assertion permanently false once this feature
 * exists alongside it.
 */
export const HistoryItem = ({ entry }: HistoryItemProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <li>
      <p>{displayPostalCode(entry.postalCode)}</p>
      {expanded && (
        <ul>
          {entry.addresses.map((address) => (
            <li
              key={`${address.prefecture}-${address.city}-${address.town}`}
            >
              {addressText(address)}
            </li>
          ))}
        </ul>
      )}
      <button
        type={"button"}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded
          ? historyText.collapseAddressesLabel
          : historyText.expandAddressesLabel}
      </button>
    </li>
  );
};
