import { formatPostalCode } from "../format-postal-code";
import { postalGeneratorText } from "../site-text";
import type { GeneratorState } from "./generator-state";

/**
 * What a live region should say for the current state (ui-design.md section
 * 8: "Announce loading, successful results, ... and request errors"). Idle
 * and loading have nothing new to say yet, so they stay silent rather than
 * repeating the last announcement.
 */
export const announcementTextOf = (state: GeneratorState): string => {
  switch (state.status) {
    case "success":
      return postalGeneratorText.resultAnnouncement(
        formatPostalCode(state.result.postalCode),
      );
    case "error":
      return postalGeneratorText.failureAnnouncement;
    case "idle":
    case "loading":
      return "";
  }
};
