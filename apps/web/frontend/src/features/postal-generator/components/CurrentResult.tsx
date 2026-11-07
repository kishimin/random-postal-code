import type { Address, PostalCode } from "@zipnami/shared";
import type { ReactNode } from "react";
import { formatPostalCode } from "../format-postal-code";
import { sharedArea } from "../shared-area";
import { postalGeneratorText } from "../site-text";
import { secondaryButtonClass } from "../styles";
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

/**
 * The postal code and addresses currently on screen (ui-design.md section
 * 5.3), plus the action that copies the postal code's canonical value.
 *
 * The headline that names this content is ResultHeadline's: Figma draws it
 * above both the result card and the map (Issue #111), so it is not here.
 *
 * Under the postal code sits the area line, the address components every
 * address shares (sharedArea, ui-design.md section 9.2). It is left out when
 * not even the prefecture is shared, rather than drawn empty.
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
}: CurrentResultProps) => {
  const area = sharedArea(result.addresses);

  return (
    <div className={"text-left"}>
      <p
        className={"hidden text-eyebrow font-semibold text-ink-muted md:block"}
      >
        {postalGeneratorText.postalCodeLabel}
      </p>
      <p
        className={
          "mt-2 text-display-sm font-bold tabular-nums text-ink lg:text-display-md"
        }
      >
        <span aria-hidden={"true"}>{"〒"}</span>
        {/* Its own element, so the code is a text of its own: the mark beside it
            is decoration, and a reader or a test looks for NNN-NNNN alone. */}
        <span>{formatPostalCode(result.postalCode)}</span>
      </p>
      {area !== undefined && (
        <p
          className={
            "mt-2 text-body font-bold wrap-anywhere text-ink lg:text-heading"
          }
        >
          {area}
        </p>
      )}
      <p className={"mt-2 text-caption text-ink-muted lg:text-eyebrow"}>
        <span className={"hidden lg:inline"}>
          {postalGeneratorText.addressCountPrefix}
        </span>
        {postalGeneratorText.addressCount(result.addresses.length)}
      </p>
      <div className={"mt-4 flex flex-wrap items-center gap-3"}>
        <button
          type={"button"}
          className={secondaryButtonClass}
          onClick={onCopy}
        >
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
    </div>
  );
};
