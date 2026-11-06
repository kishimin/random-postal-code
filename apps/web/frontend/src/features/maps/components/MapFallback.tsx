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
  <div className={"text-body-sm text-ink"}>
    <p>{mapsText.fallbackMessage}</p>
    <p className={"mt-2 font-semibold"}>{fullAddressText(address)}</p>
    <a
      className={"inline-flex min-h-11 items-center underline"}
      href={buildExternalMapHref(address)}
      target={"_blank"}
      rel={"noreferrer"}
    >
      {mapsText.externalMapLinkLabel(address)}
    </a>
  </div>
);
