import { currentResultOf, type GeneratorState } from "./hooks/generator-state";
import { postalGeneratorText } from "./site-text";

/**
 * The label the one generate action carries in this state.
 *
 * Figma labels it three ways: before a result (#2:13), after one (#2:33), and
 * while the API error shows (#27:78). The label follows what is on screen, so
 * a request in flight keeps the label of the screen it was started from.
 * @param state - The generator's current request lifecycle.
 */
export const generateActionLabel = (state: GeneratorState): string => {
  if (state.status === "error") return postalGeneratorText.retryActionLabel;
  if (currentResultOf(state)) return postalGeneratorText.regenerateActionLabel;
  return postalGeneratorText.startActionLabel;
};
