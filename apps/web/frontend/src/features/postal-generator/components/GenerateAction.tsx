import { postalGeneratorText } from "../site-text";
import { tapTargetClass } from "../styles";

type GenerateActionProps = {
  onGenerate: () => void;
  isGenerating: boolean;
};

/**
 * The primary action that requests a new random postal code.
 *
 * Disabled while a generation is already in flight (design.md section 6.1:
 * "Loading: ... prevent duplicate submission"), so a duplicate activation
 * cannot start a second request while the first is still outstanding.
 */
export const GenerateAction = ({
  onGenerate,
  isGenerating,
}: GenerateActionProps) => (
  <button
    type={"button"}
    className={tapTargetClass}
    disabled={isGenerating}
    onClick={onGenerate}
  >
    {postalGeneratorText.generateLabel}
  </button>
);
