import { postalGeneratorText } from "../site-text";
import { eyebrowClass } from "../styles";

/** The id of the result headline, which names the result card's region. */
export const RESULT_HEADING_ID = "current-result-heading";

/**
 * The result's eyebrow and headline (Figma #2:19 and #2:20).
 *
 * Figma draws them above both the result card and the map, not inside the
 * card (ui-design.md section 5.1, Issue #111), so they are their own element
 * rather than part of CurrentResult. The card still names itself after the
 * headline through aria-labelledby: aria-labelledby can point outside the
 * element it names, so the result keeps its titled region (section 8)
 * without the heading having to sit inside the card's box.
 *
 * The phone frame draws no such headline (its headline is the postal code),
 * but the result still needs its heading (WCAG 1.3.1), so below the `md`
 * breakpoint it is only visually hidden.
 */
export const ResultHeadline = () => (
  <div className={"text-left"}>
    <p className={eyebrowClass}>{postalGeneratorText.resultEyebrow}</p>
    <h2
      id={RESULT_HEADING_ID}
      className={"sr-only text-title font-bold text-ink md:not-sr-only md:mt-3"}
    >
      {postalGeneratorText.resultHeading}
    </h2>
  </div>
);
