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

/**
 * The Web generation history (design.md section 6.2, ui-design.md sections
 * 5.4 and 9.2): the 生成の履歴 card, with its list closed until the 履歴を展開
 * control opens it. An opened entry shows every address of its postal code,
 * so every stored address stays reachable.
 *
 * Nothing is rendered before the first generation: Figma draws the card only
 * with a result, and the control would have nothing to open. The list is not
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
          className={outlineButtonClass}
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {historyText.expandLabel}
        </button>
      </div>
      {expanded && (
        <ul className={"mt-4 flex flex-col gap-3"}>
          {entries.map((entry) => (
            <HistoryItem key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
};
