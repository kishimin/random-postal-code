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
 */
export const MapSection = ({
  result,
  selectedAddress,
  apiKey,
}: MapSectionProps) => {
  if (!result || !selectedAddress) return null;

  return (
    <section aria-labelledby={MAP_HEADING_ID}>
      <h2 id={MAP_HEADING_ID}>{mapsText.mapHeading}</h2>
      <AddressMap address={selectedAddress} apiKey={apiKey} />
    </section>
  );
};
