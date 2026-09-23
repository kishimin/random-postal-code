import type { PostalCode } from "@zipnami/shared";
import { formatPostalCode } from "../format-postal-code";
import { postalGeneratorText } from "../site-text";
import { tapTargetClass } from "../styles";
import { AddressList } from "./AddressList";

type CurrentResultProps = {
  result: PostalCode;
  onCopy: () => void;
};

const RESULT_HEADING_ID = "current-result-heading";

/**
 * The postal code and addresses currently on screen (ui-design.md section
 * 5.3), plus the action that copies the postal code's canonical value.
 */
export const CurrentResult = ({ result, onCopy }: CurrentResultProps) => (
  <section aria-labelledby={RESULT_HEADING_ID}>
    <h2 id={RESULT_HEADING_ID}>{postalGeneratorText.resultHeading}</h2>
    <p>{formatPostalCode(result.postalCode)}</p>
    <button type={"button"} className={tapTargetClass} onClick={onCopy}>
      {postalGeneratorText.copyLabel}
    </button>
    <AddressList addresses={result.addresses} />
  </section>
);
