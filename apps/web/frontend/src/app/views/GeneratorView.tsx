import { useState } from "react";
import { createApiClient } from "../../api/api-client";
import { MapAddressActions } from "../../features/maps/components/MapAddressActions";
import { MapSection } from "../../features/maps/components/MapSection";
import { useMapSelection } from "../../features/maps/hooks/use-map-selection";
import { CurrentResult } from "../../features/postal-generator/components/CurrentResult";
import { GenerateAction } from "../../features/postal-generator/components/GenerateAction";
import { GeneratorAnnouncer } from "../../features/postal-generator/components/GeneratorAnnouncer";
import { useGenerator } from "../../features/postal-generator/hooks/use-generator";
import { postalGeneratorText } from "../../features/postal-generator/site-text";
import { parseAppEnv } from "../schemas/env.schema";

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
  const [{ apiBaseUrl, mapsApiKey }] = useState(() =>
    parseAppEnv(import.meta.env),
  );
  const [client] = useState(() => createApiClient(apiBaseUrl));
  const { state, currentResult, announcement, copyFeedback, generate, copy } =
    useGenerator(client);
  const { selectedAddress, selectAddress } = useMapSelection(currentResult);

  return (
    <>
      <h1>{"Zipnami"}</h1>
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
        apiKey={mapsApiKey}
      />
      <GeneratorAnnouncer announcement={announcement} />
    </>
  );
};
