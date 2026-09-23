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

  // Holds the outcome of the most recent copy attempt outside GeneratorState:
  // copying is orthogonal to the request lifecycle that state models, and a
  // copy result should not be mistaken for a generation result. Cleared at
  // the start of the next generate or copy so it never outlives the attempt
  // it describes.
  const [copyAnnouncement, setCopyAnnouncement] = useState("");

  // Identifies the most recently started copy attempt. `copy` closes over
  // the value it incremented to, and only applies its settled promise's
  // result while that value is still current -- otherwise an older attempt,
  // still in flight when a newer one started, would have its later
  // resolution or rejection overwrite the newer attempt's already-announced
  // outcome (PR #36 review found this race between two overlapping
  // clipboard writes settling out of order).
  const copyAttemptRef = useRef(0);

  const generate = useCallback(() => {
    if (statusRef.current === "loading") return;

    statusRef.current = "loading";
    // A new generation supersedes any copy attempt still in flight: its
    // result describes a postal code that is no longer the current result.
    copyAttemptRef.current += 1;
    setCopyAnnouncement("");
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
    const attempt = ++copyAttemptRef.current;
    setCopyAnnouncement("");

    // ui-design.md section 5.3: "Copy success is announced in a polite
    // status region and does not move focus. Copy failure leaves the result
    // usable and offers a concise error near the action." Both outcomes are
    // announced through the same live region the request lifecycle already
    // uses (announcement, below) rather than a new UI surface.
    void navigator.clipboard
      .writeText(currentResult.postalCode)
      .then(() => {
        if (copyAttemptRef.current !== attempt) return;
        setCopyAnnouncement(postalGeneratorText.copySuccessAnnouncement);
      })
      .catch(() => {
        if (copyAttemptRef.current !== attempt) return;
        setCopyAnnouncement(postalGeneratorText.copyFailureAnnouncement);
      });
  }, [currentResult]);

  return {
    state,
    currentResult,
    announcement: copyAnnouncement || announcementTextOf(state),
    generate,
    copy,
  };
};
