import {
  announcementTones,
  type AnnouncementTone,
} from "../announcement-tones";
import { postalGeneratorText } from "../site-text";

type GeneratorAnnouncerProps = {
  announcement: string;
  tone: AnnouncementTone;
};

const statusClass = {
  quiet: "sr-only",
  loading: "mt-6 text-center text-body-sm text-ink-muted",
  error: "mt-2 text-body-sm text-ink-muted",
} as const satisfies Record<AnnouncementTone, string>;

/**
 * A polite live region announcing the generator's request lifecycle only --
 * loading, a successful result, or a request failure (ui-design.md section
 * 8: "Announce loading, successful results, ... and request errors ...
 * without repeatedly announcing unchanged content."). Always mounted, so
 * assistive technology is already listening by the time the text changes
 * from empty to something.
 *
 * A failure is drawn as Figma's "API Error panel": the mark and headline sit
 * beside the live region, not inside it, so the region still carries exactly
 * the failure's message and nothing is announced twice.
 *
 * Copy feedback is a separate concern with its own live region next to the
 * copy action (CurrentResult.tsx): PR #36 review found that merging the two
 * here let a copy attempt's announcement, once set, survive with no later
 * occasion to clear it -- permanently hiding whatever this region would
 * otherwise have said about the next generation.
 */
export const GeneratorAnnouncer = ({
  announcement,
  tone,
}: GeneratorAnnouncerProps) => (
  <div
    className={
      tone === announcementTones.error
        ? "mx-auto mt-8 max-w-[680px] rounded-card bg-error-surface p-8 text-center"
        : undefined
    }
  >
    {tone === announcementTones.error && (
      <>
        <p aria-hidden={"true"} className={"text-mystery font-bold text-error"}>
          {"!"}
        </p>
        <h2 className={"mt-2 text-heading font-bold text-ink"}>
          {postalGeneratorText.failureHeading}
        </h2>
      </>
    )}
    <div
      role={"status"}
      data-testid={"generation-announcer"}
      className={statusClass[tone]}
    >
      {announcement}
    </div>
  </div>
);
