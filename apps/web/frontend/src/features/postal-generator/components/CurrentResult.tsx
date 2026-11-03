import type { Address, PostalCode } from "@zipnami/shared";
import type { ReactNode } from "react";
import { formatPostalCode } from "../format-postal-code";
import { postalGeneratorText } from "../site-text";
import { eyebrowClass, secondaryButtonClass } from "../styles";
import { AddressList } from "./AddressList";

type CurrentResultProps = {
  result: PostalCode;
  onCopy: () => void;
  copyFeedback: string;
  /** Forwarded to AddressList -- see that component for why this exists. */
  renderAddressExtra?: (address: Address) => ReactNode;
  /** Forwarded to AddressList, which draws it on the accent surface. */
  selectedAddress?: Address;
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
  selectedAddress,
}: CurrentResultProps) => (
  <section aria-labelledby={RESULT_HEADING_ID} className={"text-left"}>
    <p className={eyebrowClass}>{postalGeneratorText.resultEyebrow}</p>
    {/* The heading keeps its accessible name "生成結果"; Figma's headline is
        what a sighted visitor reads beside it. The phone frame has no such
        headline, since its headline is the postal code. */}
    <h2 id={RESULT_HEADING_ID} className={"text-title font-bold text-ink"}>
      <span className={"sr-only"}>{postalGeneratorText.resultHeading}</span>
      <span className={"hidden md:inline"}>
        {postalGeneratorText.resultHeadline}
      </span>
    </h2>
    <p
      className={
        "mt-4 hidden text-eyebrow font-semibold text-ink-muted md:block"
      }
    >
      {postalGeneratorText.postalCodeLabel}
    </p>
    <p
      className={
        "mt-2 text-display-sm font-bold tabular-nums text-ink lg:text-display-md"
      }
    >
      <span aria-hidden={"true"}>{"〒"}</span>
      {formatPostalCode(result.postalCode)}
    </p>
    <p className={"mt-2 text-caption text-ink-muted lg:text-eyebrow"}>
      <span className={"hidden lg:inline"}>
        {postalGeneratorText.addressCountPrefix}
      </span>
      {postalGeneratorText.addressCount(result.addresses.length)}
    </p>
    <div className={"mt-4 flex flex-wrap items-center gap-3"}>
      <button type={"button"} className={secondaryButtonClass} onClick={onCopy}>
        {postalGeneratorText.copyLabel}
      </button>
      <p
        role={"status"}
        data-testid={"copy-feedback"}
        className={"text-caption text-ink-muted"}
      >
        {copyFeedback}
      </p>
    </div>
    <AddressList
      addresses={result.addresses}
      renderAddressExtra={renderAddressExtra}
      selectedAddress={selectedAddress}
    />
  </section>
);
