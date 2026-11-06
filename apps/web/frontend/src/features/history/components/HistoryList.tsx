import type { PostalCode } from "@zipnami/shared";
import { useState } from "react";
import { historyText } from "../site-text";
import { outlineButtonClass } from "../styles";
import { HistoryItem } from "./HistoryItem";

/**
 * A history entry as rendered: the canonical `PostalCode` plus a
 * client-assigned `id`. The id exists only so a rendered entry keeps its own
 * identity as new entries are prepended in front of it -- ui-design.md
 * section 5.4's "no server identifier" is about omitting a backend-assigned
 * id from what is persisted, not this one, which `useHistory` never writes to
 * storage.
 */
export type HistoryEntry = PostalCode & { readonly id: string };

type HistoryListProps = {
  entries: readonly HistoryEntry[];
};

const HISTORY_HEADING_ID = "history-heading";
const HISTORY_LIST_ID = "history-list";

/**
 * The Web generation history (design.md section 6.2, ui-design.md sections
 * 5.4 and 9.2): the 生成の履歴 card, with its list closed until the 履歴を展開
 * control opens it. An opened entry shows every address of its postal code,
 * so every stored address stays reachable.
 *
 * Nothing is rendered while there is no history: Figma draws the card only
 * with entries, and the control would have nothing to open. A stored history
 * renders on a revisit, before any generation. The list is not
 * mounted while closed, so a superseded generation's addresses are not in the
 * page unless a visitor asks for them -- random-postal-code-experience's
 * "regenerating" case asserts a superseded address is gone from the page.
 */
export const HistoryList = ({ entries }: HistoryListProps) => {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby={HISTORY_HEADING_ID}
      className={"mt-12 rounded-card bg-card p-6"}
    >
      <div className={"flex flex-wrap items-center justify-between gap-3"}>
        <h2 id={HISTORY_HEADING_ID} className={"text-body font-bold text-ink"}>
          {historyText.heading}
        </h2>
        <button
          type={"button"}
          className={`${outlineButtonClass} gap-2`}
          aria-expanded={expanded}
          // Only while the list is mounted: it does not exist when closed, and
          // an IDREF to nothing is a broken reference.
          aria-controls={expanded ? HISTORY_LIST_ID : undefined}
          onClick={() => setExpanded((current) => !current)}
        >
          {historyText.expandLabel}
          {/* The state is already in aria-expanded; this only shows it. */}
          <svg
            aria-hidden={"true"}
            focusable={"false"}
            viewBox={"0 0 12 12"}
            className={`h-3 w-3 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            fill={"none"}
            stroke={"currentColor"}
            strokeWidth={2}
          >
            <path d={"M2 4l4 4 4-4"} />
          </svg>
        </button>
      </div>
      {expanded && (
        <ul id={HISTORY_LIST_ID} className={"mt-4 flex flex-col gap-3"}>
          {entries.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
};
