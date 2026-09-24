import { useState } from "react";
import { createApiClient } from "../../api/api-client";
import { HistoryList } from "../../features/history/components/HistoryList";
import { useHistory } from "../../features/history/hooks/use-history";
import { CurrentResult } from "../../features/postal-generator/components/CurrentResult";
import { GenerateAction } from "../../features/postal-generator/components/GenerateAction";
import { GeneratorAnnouncer } from "../../features/postal-generator/components/GeneratorAnnouncer";
import { useGenerator } from "../../features/postal-generator/hooks/use-generator";
import { postalGeneratorText } from "../../features/postal-generator/site-text";
import { parseAppEnv } from "../schemas/env.schema";

/**
 * Generator screen (Issue #6): the generate action, its current result, and
 * the live region that announces a new result or a failure.
 *
 * The API client is built here, in the application layer, rather than inside
 * the feature hook: api-client.ts stays free of environment access so it can
 * be configured without a build (see that module's own docstring), and
 * env.schema.ts is an app/-owned module the features/ boundary is not
 * allowed to import.
 */
export const GeneratorView = () => {
  const [client] = useState(() =>
    createApiClient(parseAppEnv(import.meta.env).apiBaseUrl),
  );
  const { entries, addEntry } = useHistory();
  const { state, currentResult, announcement, copyFeedback, generate, copy } =
    useGenerator(client, { onGenerated: addEntry });

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
          />
        )}
      </div>
      <GeneratorAnnouncer announcement={announcement} />
      <HistoryList entries={entries} />
    </>
  );
};
