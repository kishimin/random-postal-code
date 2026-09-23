type GeneratorAnnouncerProps = {
  announcement: string;
};

/**
 * A polite live region announcing the generator's request lifecycle only --
 * loading, a successful result, or a request failure (ui-design.md section
 * 8: "Announce loading, successful results, ... and request errors ...
 * without repeatedly announcing unchanged content."). Always mounted, so
 * assistive technology is already listening by the time the text changes
 * from empty to something.
 *
 * Copy feedback is a separate concern with its own live region next to the
 * copy action (CurrentResult.tsx): PR #36 review found that merging the two
 * here let a copy attempt's announcement, once set, survive with no later
 * occasion to clear it -- permanently hiding whatever this region would
 * otherwise have said about the next generation.
 */
export const GeneratorAnnouncer = ({
  announcement,
}: GeneratorAnnouncerProps) => (
  <div role={"status"} data-testid={"generation-announcer"}>
    {announcement}
  </div>
);
