import { render, screen } from "@testing-library/react";
import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { historyText } from "../site-text";
import { HistoryList } from "./HistoryList";

const firstEntry: PostalCode & { id: string } = {
  id: "1",
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondEntry: PostalCode & { id: string } = {
  id: "2",
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

describe("HistoryList", () => {
  // ui-design.md section 8: a heading identifies the history region.
  test("shows a heading even when there is no history yet", () => {
    render(<HistoryList entries={[]} />);

    expect(
      screen.getByRole("heading", { name: historyText.heading }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  // design.md section 6.2: history is rendered newest first, in whatever
  // order the caller already prepared it -- ordering itself is
  // prependHistoryEntry's own contract (history-state.small.test.ts).
  test("renders one entry per history item, in the given order", () => {
    render(<HistoryList entries={[secondEntry, firstEntry]} />);

    const postalCodes = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent?.match(/\d{3}-\d{4}/)?.at(0));

    expect(postalCodes).toEqual(["530-0001", "100-0001"]);
  });
});
