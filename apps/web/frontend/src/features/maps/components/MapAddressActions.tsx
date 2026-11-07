import type { Address } from "@zipnami/shared";
import { buildExternalMapHref } from "../lib/map-url";
import { mapsText } from "../site-text";

type MapAddressActionsProps = {
  address: Address;
  isSelected: boolean;
  onSelect: () => void;
};

/**
 * One address's map actions, rendered inside that address's own list entry
 * (ui-design.md section 5.3 and section 8's per-address accessible name
 * requirement): the button that makes it the embedded map's target, and the
 * external Google Maps link every address carries regardless of selection.
 *
 * Figma repeats the same two labels on every address, so each control's
 * visible text is Figma's and its accessible name puts the address in front
 * of that text (ui-design.md section 9.2). The visible words stay inside the
 * name, so a speech-recognition user who says what they read is understood
 * (WCAG 2.5.3).
 *
 * The pair sits on its own line, right-aligned under the address (Figma node
 * 1:4, Issue #111). The button is Figma's outline button, except that the
 * selected address's stays filled: the accent surface behind the selected
 * entry is too close to white to show the selection without color (WCAG
 * 1.4.1), and ui-design.md section 9.1 lets AA win over Figma.
 */
export const MapAddressActions = ({
  address,
  isSelected,
  onSelect,
}: MapAddressActionsProps) => (
  <span className={"flex flex-wrap items-center justify-end gap-x-3 gap-y-1"}>
    <button
      type={"button"}
      aria-pressed={isSelected}
      aria-label={mapsText.selectMapTargetLabel(address)}
      className={
        "inline-flex min-h-11 items-center rounded-full border border-brand bg-card px-4 text-caption font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink aria-pressed:bg-brand aria-pressed:text-card"
      }
      onClick={onSelect}
    >
      {mapsText.selectMapTargetText}
    </button>
    <a
      aria-label={mapsText.externalMapLinkLabel(address)}
      className={
        "inline-flex min-h-11 items-center text-caption font-semibold text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      }
      href={buildExternalMapHref(address)}
      target={"_blank"}
      rel={"noreferrer"}
    >
      {mapsText.externalMapLinkText}
    </a>
  </span>
);
