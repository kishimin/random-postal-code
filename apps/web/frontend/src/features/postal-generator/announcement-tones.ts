/**
 * How the announcement is shown. Every tone is announced; the tone decides
 * only what a sighted visitor sees. A success is already on screen as the
 * result itself, so it stays visually hidden; a pending request and a failure
 * are stated in words (ui-design.md section 8: no status by color alone).
 */
export const announcementTones = {
  quiet: "quiet",
  loading: "loading",
  error: "error",
} as const;

export type AnnouncementTone =
  (typeof announcementTones)[keyof typeof announcementTones];
