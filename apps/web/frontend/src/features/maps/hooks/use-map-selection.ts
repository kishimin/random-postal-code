import type { Address, PostalCode } from "@zipnami/shared";
import { useCallback, useReducer } from "react";
import {
  initialMapSelectionState,
  mapSelectionReducer,
} from "./map-selection-state";

export type UseMapSelectionResult = {
  selectedAddress: Address | undefined;
  selectAddress: (address: Address) => void;
};

/**
 * The embedded map's current address selection for `result` (ui-design.md
 * section 5.3).
 *
 * Dispatches "result-changed" during render rather than in a `useEffect`:
 * this is adjusting state to a changed prop, not synchronizing with a system
 * outside React, so committing the reset in the same render `result` itself
 * changed avoids a render where the map still shows the previous result's
 * selection.
 */
export const useMapSelection = (
  result: PostalCode | undefined,
): UseMapSelectionResult => {
  const [state, dispatch] = useReducer(
    mapSelectionReducer,
    result,
    initialMapSelectionState,
  );

  if (state.result !== result) {
    dispatch({ type: "result-changed", result });
  }

  const selectAddress = useCallback(
    (address: Address) => dispatch({ type: "address-selected", address }),
    [],
  );

  return { selectedAddress: state.selectedAddress, selectAddress };
};
