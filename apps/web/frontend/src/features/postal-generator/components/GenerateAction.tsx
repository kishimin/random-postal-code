import { useEffect, useRef } from "react";
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
 *
 * Disabling a focused button hands focus to the platform (most browsers move
 * it to the document body) the instant `disabled` is applied -- before the
 * effect below could ever observe the button as the active element -- so
 * whether the click that started this generation left the button focused is
 * captured synchronously in the click handler instead. The effect only syncs
 * with that recorded, browser-owned focus outcome once loading ends,
 * restoring it so an activation that started here does not silently lose its
 * place once the result arrives.
 */
export const GenerateAction = ({
  onGenerate,
  isGenerating,
}: GenerateActionProps) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hadFocusWhenDisabled = useRef(false);

  useEffect(() => {
    if (isGenerating || !hadFocusWhenDisabled.current) return;

    buttonRef.current?.focus();
    hadFocusWhenDisabled.current = false;
  }, [isGenerating]);

  const handleClick = () => {
    hadFocusWhenDisabled.current =
      document.activeElement === buttonRef.current;
    onGenerate();
  };

  return (
    <button
      ref={buttonRef}
      type={"button"}
      className={tapTargetClass}
      disabled={isGenerating}
      onClick={handleClick}
    >
      {postalGeneratorText.generateLabel}
    </button>
  );
};
