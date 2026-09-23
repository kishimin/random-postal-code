type GeneratorAnnouncerProps = {
  announcement: string;
};

/**
 * A polite live region announcing the current result or failure
 * (ui-design.md section 8: "Announce loading, successful results, ... and
 * request errors ... without repeatedly announcing unchanged content.").
 * Always mounted, so assistive technology is already listening by the time
 * the text changes from empty to something.
 */
export const GeneratorAnnouncer = ({
  announcement,
}: GeneratorAnnouncerProps) => <div role={"status"}>{announcement}</div>;
