import type { PostalCode } from "@zipnami/shared";
import { useCallback, useReducer, useRef } from "react";
import { fetchRandomPostalCode, type ApiClient } from "../../../api/api-client";
import { announcementTextOf } from "./announcement";
import { classifyGeneratorError } from "./classify-error";
import {
  currentResultOf,
  generatorReducer,
  initialGeneratorState,
  type GeneratorState,
} from "./generator-state";

export type UseGeneratorResult = {
  state: GeneratorState;
  currentResult: PostalCode | undefined;
  announcement: string;
  generate: () => void;
  copy: () => void;
};

/**
 * Orchestrates one generator screen's request lifecycle against `client`:
 * issuing `GET /api/random`, guarding a duplicate activation while a request
 * is in flight, and copying the current result to the clipboard.
 *
 * A ref mirrors the in-flight status so `generate` can refuse a second
 * activation synchronously, at the moment it is requested. State alone would
 * not reflect "loading" again until the next render, by which point a second
 * call may already have started its own fetch (design.md section 4:
 * "Loading disables only duplicate generation.").
 */
export const useGenerator = (client: ApiClient): UseGeneratorResult => {
  const [state, dispatch] = useReducer(generatorReducer, initialGeneratorState);
  const statusRef = useRef(state.status);

  const generate = useCallback(() => {
    if (statusRef.current === "loading") return;

    statusRef.current = "loading";
    dispatch({ type: "generate/started" });

    void fetchRandomPostalCode(client)
      .then((result) => {
        statusRef.current = "success";
        dispatch({ type: "generate/succeeded", result });
      })
      .catch((error: unknown) => {
        statusRef.current = "error";
        dispatch({
          type: "generate/failed",
          error: classifyGeneratorError(error),
        });
      });
  }, [client]);

  const copy = useCallback(() => {
    const currentResult = currentResultOf(state);
    if (!currentResult) return;

    // Copy failure is outside this Issue's tested scope (design.md section
    // 5.3 describes a fuller contract); swallowing it here keeps the result
    // usable instead of raising an unhandled rejection.
    void navigator.clipboard
      .writeText(currentResult.postalCode)
      .catch(() => undefined);
  }, [state]);

  return {
    state,
    currentResult: currentResultOf(state),
    announcement: announcementTextOf(state),
    generate,
    copy,
  };
};
