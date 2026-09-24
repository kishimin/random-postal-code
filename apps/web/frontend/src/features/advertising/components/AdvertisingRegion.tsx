import { adsenseScriptUrl } from "../config";
import { useAdsenseScript } from "../hooks/use-adsense-script";
import { advertisingText } from "../site-text";
import { AdSlot } from "./AdSlot";

type AdvertisingRegionProps = {
  clientId: string;
  slotId: string;
  testMode: boolean;
};

const ADVERTISING_LABEL_ID = "advertising-region-label";

/**
 * The reserved advertisement region (ui-design.md section 5.2: "AdSense slot
 * and consent boundary"; design.md section 7: "a dedicated region labeled as
 * advertising").
 *
 * Always rendered, independent of whether the loader script ever succeeds --
 * design.md section 7 requires an optional dependency's failure to leave
 * already-successful core behavior untouched, and this region carries none of
 * that core behavior itself. `<p>` rather than a heading: ui-design.md
 * section 8 lists headings for result, map, and history, not advertising, so
 * this label does not add another entry to the page's heading outline.
 */
export const AdvertisingRegion = ({
  clientId,
  slotId,
  testMode,
}: AdvertisingRegionProps) => {
  useAdsenseScript(adsenseScriptUrl(clientId));

  return (
    <section aria-labelledby={ADVERTISING_LABEL_ID}>
      <p id={ADVERTISING_LABEL_ID}>{advertisingText.regionLabel}</p>
      <AdSlot clientId={clientId} slotId={slotId} testMode={testMode} />
    </section>
  );
};
