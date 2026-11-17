import type { GeneratorState } from "./generator-state";
import { generatorText } from "./generator-text";
import { formatPostalCode } from "./postal-code-label";

/**
 * What a screen reader should hear when the generator enters `state`, or
 * undefined when nothing changed that is worth saying. ui-design.md asks
 * for loading, results, and request errors to be announced; on iOS a
 * role="alert" view is not read on its own, so the screen announces each
 * of them explicitly on both platforms.
 * @param {GeneratorState} state - The state just entered.
 */
export const announcementOf = (state: GeneratorState): string | undefined => {
  switch (state.status) {
    case "idle":
      return undefined;
    case "loading":
      return generatorText.loadingAction;
    case "success": {
      const displayed = formatPostalCode(state.result.postalCode);
      return displayed === undefined
        ? undefined
        : generatorText.resultAnnouncement(displayed.slice(1));
    }
    case "error":
      return `${generatorText.failureHeading}。${generatorText.failure[state.failure]}`;
  }
};
