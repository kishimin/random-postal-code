import { postalGeneratorText } from "../site-text";

/**
 * Figma's placeholder inside the start card: a code with its digits still
 * unknown. The code is decoration, so a screen reader skips it; the note under
 * it is read.
 */
export const MysteryPlaceholder = () => (
  <>
    <p
      aria-hidden={"true"}
      className={
        "text-title font-bold text-ink md:text-display-md lg:text-mystery"
      }
    >
      {postalGeneratorText.mysteryCode}
    </p>
    <p className={"mt-3 text-body-sm text-ink-muted"}>
      {postalGeneratorText.mysteryNote}
    </p>
  </>
);
