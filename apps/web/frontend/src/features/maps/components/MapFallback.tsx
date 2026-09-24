import type { Address } from "@zipnami/shared";
import { buildExternalMapHref, fullAddressText } from "../lib/map-url";
import { mapsText } from "../site-text";

type MapFallbackProps = {
  address: Address;
};

/**
 * The map failure fallback (ui-design.md section 7): the selected address's
 * full text and an external Google Maps link, shown in place of the embedded
 * map when it has no usable key or failed to load.
 */
export const MapFallback = ({ address }: MapFallbackProps) => (
  <div>
    <p>{mapsText.fallbackMessage}</p>
    <p>{fullAddressText(address)}</p>
    <a href={buildExternalMapHref(address)} target={"_blank"} rel={"noreferrer"}>
      {mapsText.externalMapLinkLabel(address)}
    </a>
  </div>
);
