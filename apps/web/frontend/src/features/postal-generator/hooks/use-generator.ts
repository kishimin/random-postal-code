import type { PostalCode } from "@zipnami/shared";
import { useCallback, useReducer, useRef, useState } from "react";
import { fetchRandomPostalCode, type ApiClient } from "../../../api/api-client";
import { postalGeneratorText } from "../site-text";
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
 * call may already have started its own fetch (ui-design.md section 4:
 * "Loading disables only duplicate generation.").
 */
export const useGenerator = (client: ApiClient): UseGeneratorResult => {
  const [state, dispatch] = useReducer(generatorReducer, initialGeneratorState);
  const statusRef = useRef<GeneratorState["status"]>("idle");
  const currentResult = currentResultOf(state);

  // Holds a copy failure's message outside GeneratorState: copying is
  // orthogonal to the request lifecycle that state models, and a failed
  // clipboard write should not be mistaken for a failed generation. Cleared
  // at the start of the next generate or copy so it never outlives the
  // attempt it describes.
  const [copyError, setCopyError] = useState("");

  const generate = useCallback(() => {
    if (statusRef.current === "loading") return;

    statusRef.current = "loading";
    setCopyError("");
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
    if (!currentResult) return;
    setCopyError("");

    // ui-design.md section 5.3: "Copy failure leaves the result usable and
    // offers a concise error near the action." The failure is announced
    // through the same live region the request lifecycle already uses
    // (announcement, below) rather than a new UI surface.
    void navigator.clipboard.writeText(currentResult.postalCode).catch(() => {
      setCopyError(postalGeneratorText.copyFailureAnnouncement);
    });
  }, [currentResult]);

  return {
    state,
    currentResult,
    announcement: copyError || announcementTextOf(state),
    generate,
    copy,
  };
};
