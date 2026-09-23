import { ApiRequestError } from "../../../api/api-client";
import type { UiError } from "./generator-state";

/**
 * Maps a rejection from `fetchRandomPostalCode` to the `UiError` kind
 * ui-design.md section 4 defines, without deciding how each kind is presented
 * (ui-design.md section 12 leaves that wording to this Issue).
 */
export const classifyGeneratorError = (error: unknown): UiError => {
  if (error instanceof ApiRequestError) {
    return error.code === "DATA_UNAVAILABLE"
      ? { kind: "service-unavailable", requestId: error.requestId }
      : { kind: "unexpected", requestId: error.requestId };
  }

  // fetch() rejects with a TypeError when the request never reached a
  // server -- offline, DNS failure, or blocked by the network.
  if (error instanceof TypeError) {
    return { kind: "offline" };
  }

  // Anything else -- most often postalCodeSchema.parse's ZodError -- means
  // the endpoint answered but not with a body this client understands.
  return { kind: "invalid-response" };
};
