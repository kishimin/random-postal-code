import { formatPostalCode } from "../format-postal-code";
import { postalGeneratorText } from "../site-text";
import type { GeneratorState } from "./generator-state";

/**
 * What a live region should say for the current state (ui-design.md section
 * 8: "Announce loading, successful results, ... and request errors"). Idle
 * has nothing to say yet -- nothing has happened -- so it stays silent
 * rather than repeating the last announcement.
 */
export const announcementTextOf = (state: GeneratorState): string => {
  switch (state.status) {
    case "loading":
      return postalGeneratorText.loadingAnnouncement;
    case "success":
      return postalGeneratorText.resultAnnouncement(
        formatPostalCode(state.result.postalCode),
      );
    case "error":
      return postalGeneratorText.failureAnnouncement[state.error.kind];
    case "idle":
      return "";
  }
};
