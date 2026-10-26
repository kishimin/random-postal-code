import { useState } from "react";
import { createApiClient } from "../../api/api-client";
import { AdvertisingRegion } from "../../features/advertising/components/AdvertisingRegion";
import { HistoryList } from "../../features/history/components/HistoryList";
import { useHistory } from "../../features/history/hooks/use-history";
import { MapAddressActions } from "../../features/maps/components/MapAddressActions";
import { MapSection } from "../../features/maps/components/MapSection";
import { useMapSelection } from "../../features/maps/hooks/use-map-selection";
import { CurrentResult } from "../../features/postal-generator/components/CurrentResult";
import { GenerateAction } from "../../features/postal-generator/components/GenerateAction";
import { GeneratorAnnouncer } from "../../features/postal-generator/components/GeneratorAnnouncer";
import { useGenerator } from "../../features/postal-generator/hooks/use-generator";
import { postalGeneratorText } from "../../features/postal-generator/site-text";
import { useDocumentTitle } from "../../hooks/use-document-title";
import { parseAppEnv } from "../schemas/env.schema";
import { pageTitle, siteText } from "../site-text";

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
 */
export const GeneratorView = () => {
  const [env] = useState(() => parseAppEnv(import.meta.env));
  const [client] = useState(() => createApiClient(env.apiBaseUrl));
  const { entries, addEntry } = useHistory();
  const { state, currentResult, announcement, copyFeedback, generate, copy } =
    useGenerator(client, { onGenerated: addEntry });
  const { selectedAddress, selectAddress } = useMapSelection(currentResult);

  useDocumentTitle(pageTitle());

  return (
    <>
      {/* tabIndex: RootLayout focuses a screen's own h1 after a client-side
          route change (Issue #16 AC-5), and a plain heading is not in the
          focusable area without one. */}
      <h1 tabIndex={-1}>{siteText.name}</h1>
      <p>{postalGeneratorText.explanation}</p>
      <GenerateAction
        onGenerate={generate}
        isGenerating={state.status === "loading"}
      />
      {/* ui-design.md section 8: "Set aria-busy on the result region during
          generation." Wrapped rather than set on CurrentResult itself so the
          attribute is present even on a first generation, before any result
          exists to render. */}
      <div data-testid={"result-region"} aria-busy={state.status === "loading"}>
        {currentResult && (
          <CurrentResult
            result={currentResult}
            onCopy={copy}
            copyFeedback={copyFeedback}
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
      <MapSection
        result={currentResult}
        selectedAddress={selectedAddress}
        apiKey={env.mapsApiKey}
      />
      <GeneratorAnnouncer announcement={announcement} />
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
