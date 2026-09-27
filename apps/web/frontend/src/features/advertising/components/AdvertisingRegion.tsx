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
 *
 * The border, background, and label styling are presentation only (CR-004 of
 * Issue #9's review): without them, the only thing separating this region
 * from application content was the word "広告" itself. ADR-0012 keeps
 * appearance out of automated tests, so nothing here asserts these classes;
 * the manual checklist in ui-design.md section 10 covers the visual result.
 */
export const AdvertisingRegion = ({
  clientId,
  slotId,
  testMode,
}: AdvertisingRegionProps) => {
  useAdsenseScript(adsenseScriptUrl(clientId));

  return (
    <section
      aria-labelledby={ADVERTISING_LABEL_ID}
      className={"rounded-md border border-gray-300 bg-gray-50 p-4"}
    >
      <p
        id={ADVERTISING_LABEL_ID}
        className={"mb-2 text-xs font-medium text-gray-600"}
      >
        {advertisingText.regionLabel}
      </p>
      <AdSlot clientId={clientId} slotId={slotId} testMode={testMode} />
    </section>
  );
};
