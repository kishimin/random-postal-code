import type { Address, PostalCode } from "@zipnami/shared";
import type { ReactNode } from "react";
import { formatPostalCode } from "../format-postal-code";
import { postalGeneratorText } from "../site-text";
import { tapTargetClass } from "../styles";
import { AddressList } from "./AddressList";

type CurrentResultProps = {
  result: PostalCode;
  onCopy: () => void;
  copyFeedback: string;
  /** Forwarded to AddressList -- see that component for why this exists. */
  renderAddressExtra?: (address: Address) => ReactNode;
};

const RESULT_HEADING_ID = "current-result-heading";

/**
 * The postal code and addresses currently on screen (ui-design.md section
 * 5.3), plus the action that copies the postal code's canonical value.
 *
 * `copyFeedback` renders as its own polite status region immediately after
 * the copy action, before the address list -- ui-design.md section 5.3:
 * "Copy failure leaves the result usable and offers a concise error near the
 * action." PR #36 review found that feedback announced only in
 * GeneratorAnnouncer, mounted below this whole section: on a result with
 * many addresses, that landed off-screen for a visitor who stayed near the
 * copy button. Always mounted, empty or not -- the same reason
 * GeneratorAnnouncer gives for doing so: a region assistive technology has
 * not yet registered as live cannot be relied on to announce the text it is
 * born already containing.
 */
export const CurrentResult = ({
  result,
  onCopy,
  copyFeedback,
  renderAddressExtra,
}: CurrentResultProps) => (
  <section aria-labelledby={RESULT_HEADING_ID}>
    <h2 id={RESULT_HEADING_ID}>{postalGeneratorText.resultHeading}</h2>
    <p>{formatPostalCode(result.postalCode)}</p>
    <button type={"button"} className={tapTargetClass} onClick={onCopy}>
      {postalGeneratorText.copyLabel}
    </button>
    <p role={"status"} data-testid={"copy-feedback"}>
      {copyFeedback}
    </p>
    <AddressList
      addresses={result.addresses}
      renderAddressExtra={renderAddressExtra}
    />
  </section>
);
