import { useState } from "react";
import { createApiClient } from "../../api/api-client";
import { AdvertisingRegion } from "../../features/advertising/components/AdvertisingRegion";
import { HistoryList } from "../../features/history/components/HistoryList";
import { useHistory } from "../../features/history/hooks/use-history";
import { MapAddressActions } from "../../features/maps/components/MapAddressActions";
import { MapSection } from "../../features/maps/components/MapSection";
import { useMapSelection } from "../../features/maps/hooks/use-map-selection";
import {
  announcementTones,
  type AnnouncementTone,
} from "../../features/postal-generator/announcement-tones";
import { CurrentResult } from "../../features/postal-generator/components/CurrentResult";
import { GenerateAction } from "../../features/postal-generator/components/GenerateAction";
import { GeneratorAnnouncer } from "../../features/postal-generator/components/GeneratorAnnouncer";
import { MysteryPlaceholder } from "../../features/postal-generator/components/MysteryPlaceholder";
import {
  RESULT_HEADING_ID,
  ResultHeadline,
} from "../../features/postal-generator/components/ResultHeadline";
import { generateActionLabel } from "../../features/postal-generator/generate-action-label";
import type { GeneratorState } from "../../features/postal-generator/hooks/generator-state";
import { useGenerator } from "../../features/postal-generator/hooks/use-generator";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { parseAppEnv } from "../schemas/env.schema";
import { pageTitle } from "../site-text";
import { GeneratorHero } from "./GeneratorHero";

const toneByStatus = {
  idle: announcementTones.quiet,
  loading: announcementTones.loading,
  success: announcementTones.quiet,
  error: announcementTones.error,
} as const satisfies Record<GeneratorState["status"], AnnouncementTone>;

// Figma's start card is the accent-surface "Mystery card"; once a result
// exists the same box becomes the white "Address panel". It is one element
// that changes its look, not two, so the generate action keeps its place in
// the document and its focus across a generation. For the same reason the
// box is a <section> in both states: it becomes the region the result
// headline names once there is a result, and is an unnamed section, which is
// no region at all, before that.
const startCardClass =
  "mx-auto mt-8 max-w-[660px] rounded-panel bg-accent-surface px-6 py-10 text-center lg:mt-12";
const resultCardClass = "rounded-card bg-card p-6 lg:p-8";

/**
 * Generator screen (Issue #6, extended by Issue #8's maps region): the
 * generate action, its current result, the embedded map for whichever
 * address is currently selected, and the live region that announces a new
 * result or a failure.
 *
 * The API client and the environment are built here, in the application
 * layer, rather than inside a feature hook: api-client.ts and the maps
 * feature stay free of environment access so they can be configured without
 * a build, and env.schema.ts is an app/-owned module the features/ boundary
 * is not allowed to import.
 *
 * "Which address is selected" is lifted to this level because AddressList's
 * per-address action and the map region are siblings in the tree below --
 * CurrentResult and MapSection -- with no other shared ancestor to hold it.
 *
 * Once a result exists, the eyebrow and the headline come first and span
 * both columns above the result card and the map, which split 560:720 at
 * `lg` and stretch to the same height (ui-design.md section 5.1, Issue #111).
 * The headline is a sibling inserted ahead of the card, not a wrapper around
 * it, so the card keeps its place among its siblings and is not remounted.
 */
export const GeneratorView = () => {
  const [env] = useState(() => parseAppEnv(import.meta.env));
  const [client] = useState(() => createApiClient(env.apiBaseUrl));
  const { entries, addEntry } = useHistory();
  const { state, currentResult, announcement, copyFeedback, generate, copy } =
    useGenerator(client, { onGenerated: addEntry });
  const { selectedAddress, selectAddress } = useMapSelection(currentResult);

  useDocumentTitle(pageTitle());

  const hasResult = currentResult !== undefined;

  return (
    <>
      <GeneratorHero hasResult={hasResult} />
      <GeneratorAnnouncer
        announcement={announcement}
        tone={toneByStatus[state.status]}
      />
      <div
        className={
          hasResult
            ? "mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,560fr)_minmax(0,720fr)] lg:gap-8"
            : undefined
        }
      >
        {hasResult && (
          <div className={"lg:col-span-2"}>
            <ResultHeadline />
          </div>
        )}
        <section
          aria-labelledby={hasResult ? RESULT_HEADING_ID : undefined}
          className={hasResult ? resultCardClass : startCardClass}
        >
          {!hasResult && <MysteryPlaceholder />}
          {/* ui-design.md section 8: "Set aria-busy on the result region
              during generation." Wrapped rather than set on CurrentResult
              itself so the attribute is present even on a first generation,
              before any result exists to render. */}
          <div
            data-testid={"result-region"}
            aria-busy={state.status === "loading"}
          >
            {currentResult && (
              <CurrentResult
                result={currentResult}
                onCopy={copy}
                copyFeedback={copyFeedback}
                selectedAddress={selectedAddress}
                renderAddressExtra={(address) => (
                  <MapAddressActions
                    address={address}
                    isSelected={address === selectedAddress}
                    onSelect={() => selectAddress(address)}
                  />
                )}
              />
            )}
          </div>
          <div className={hasResult ? "mt-6" : "mx-auto mt-8 max-w-[280px]"}>
            <GenerateAction
              label={generateActionLabel(state)}
              onGenerate={generate}
              isGenerating={state.status === "loading"}
            />
          </div>
        </section>
        <MapSection
          result={currentResult}
          selectedAddress={selectedAddress}
          apiKey={env.mapsApiKey}
        />
      </div>
      <HistoryList entries={entries} />
      {/* ui-design.md section 5.1: the reserved advertisement region sits
          after the current result and before the footer, so it never
          competes with the primary action for a visitor's attention. */}
      <AdvertisingRegion
        clientId={env.googleAdsenseClientId}
        slotId={env.googleAdsenseSlotId}
        testMode={env.useTestAds}
      />
    </>
  );
};
