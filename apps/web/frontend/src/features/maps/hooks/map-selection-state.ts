import type { Address, PostalCode } from "@zipnami/shared";

export type MapSelectionState = {
  result: PostalCode | undefined;
  selectedAddress: Address | undefined;
};

export type MapSelectionAction =
  | { type: "result-changed"; result: PostalCode | undefined }
  | { type: "address-selected"; address: Address };

/**
 * ui-design.md section 5.3: "The first address is the initial map
 * selection." Applies to the very first result and, through
 * `mapSelectionReducer`'s "result-changed" case, to every result after it.
 * @param {PostalCode | undefined} result - The current generator result, or undefined before one exists.
 */
export const initialMapSelectionState = (
  result: PostalCode | undefined,
): MapSelectionState => ({
  result,
  selectedAddress: result?.addresses[0],
});

/**
 * Advances the embedded map's selection (ui-design.md section 5.3).
 *
 * "result-changed" is a no-op when `action.result` is the same result the
 * state already carries: a component re-synchronizing this state on every
 * render must not reset a selection the visitor already changed just
 * because nothing about the result actually changed.
 */
export const mapSelectionReducer = (
  state: MapSelectionState,
  action: MapSelectionAction,
): MapSelectionState => {
  switch (action.type) {
    case "result-changed":
      return action.result === state.result
        ? state
        : initialMapSelectionState(action.result);
    case "address-selected":
      return { ...state, selectedAddress: action.address };
  }
};
