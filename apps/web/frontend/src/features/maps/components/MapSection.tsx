import type { Address, PostalCode } from "@zipnami/shared";
import { mapsText } from "../site-text";
import { AddressMap } from "./AddressMap";

type MapSectionProps = {
  result: PostalCode | undefined;
  selectedAddress: Address | undefined;
  apiKey: string;
};

const MAP_HEADING_ID = "map-heading";

/**
 * The labeled map region (ui-design.md sections 5.1 and 7): absent before a
 * result exists, so a first visit never shows an empty iframe, and showing
 * the embedded map for whichever address is currently selected once one
 * does.
 *
 * At `lg` and wider the panel stretches to the result card's height, and the
 * map fills what its heading leaves (ui-design.md section 5.1, Issue #111).
 */
export const MapSection = ({
  result,
  selectedAddress,
  apiKey,
}: MapSectionProps) => {
  if (!result || !selectedAddress) return null;

  return (
    <section
      aria-labelledby={MAP_HEADING_ID}
      className={"rounded-card bg-map-surface p-4 lg:flex lg:flex-col lg:p-6"}
    >
      <h2
        id={MAP_HEADING_ID}
        className={"mb-3 text-eyebrow font-semibold text-ink-muted"}
      >
        {mapsText.mapHeading}
      </h2>
      <div className={"lg:flex-1"}>
        <AddressMap address={selectedAddress} apiKey={apiKey} />
      </div>
    </section>
  );
};
