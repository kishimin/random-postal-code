import type { PostalCode } from "@zipnami/shared";
import { historyText } from "../site-text";
import { HistoryItem } from "./HistoryItem";

/**
 * A history entry as rendered: the canonical `PostalCode` plus a
 * client-assigned `id`. The id exists only so a rendered entry keeps its own
 * identity (and expand/collapse state) as new entries are prepended in front
 * of it -- ui-design.md section 5.4's "no server identifier" is about
 * omitting a backend-assigned id from what is persisted, not this one, which
 * `useHistory` never writes to storage.
 */
export type HistoryEntry = PostalCode & { readonly id: string };

type HistoryListProps = {
  entries: readonly HistoryEntry[];
};

const HISTORY_HEADING_ID = "history-heading";

/**
 * The Web generation history (design.md section 6.2, ui-design.md section
 * 5.4): a heading identifying the region, and one list item per past
 * generation. Rendered even with no entries yet, so the heading
 * (ui-design.md section 8) is always present once a visitor has generated at
 * least once.
 */
export const HistoryList = ({ entries }: HistoryListProps) => (
  <section aria-labelledby={HISTORY_HEADING_ID}>
    <h2 id={HISTORY_HEADING_ID}>{historyText.heading}</h2>
    <ul>
      {entries.map((entry) => (
        <HistoryItem key={entry.id} entry={entry} />
      ))}
    </ul>
  </section>
);
