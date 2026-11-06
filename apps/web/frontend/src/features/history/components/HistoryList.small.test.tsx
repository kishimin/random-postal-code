import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { HistoryList } from "./HistoryList";

const firstEntry: PostalCode & { id: string } = {
  id: "1",
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondEntry: PostalCode & { id: string } = {
  id: "2",
  postalCode: "5300001",
  addresses: [
    { prefecture: "大阪府", city: "大阪市北区", town: "梅田" },
    { prefecture: "大阪府", city: "大阪市北区", town: "中之島" },
  ],
};

describe("HistoryList", () => {
  // Figma draws the history card only once there is something to list, and
  // its 履歴を展開 control has nothing to open before then (Issue #97).
  test("renders nothing before the first generation", () => {
    const { container } = render(<HistoryList entries={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  // ui-design.md section 8: a heading identifies the history region.
  test("is a region titled 生成の履歴, with its list closed behind 履歴を展開", () => {
    render(<HistoryList entries={[secondEntry, firstEntry]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "生成の履歴" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "生成の履歴" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "履歴を展開" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  // design.md section 6.2: history is rendered newest first, in whatever
  // order the caller already prepared it -- ordering itself is
  // prependHistoryEntry's own contract (history-state.small.test.ts).
  test("opens one entry per history item, in the given order, each with every address", async () => {
    const user = userEvent.setup();
    render(<HistoryList entries={[secondEntry, firstEntry]} />);

    await user.click(screen.getByRole("button", { name: "履歴を展開" }));

    expect(screen.getByRole("button", { name: "履歴を展開" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const postalCodes = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent?.match(/\d{3}-\d{4}/)?.at(0))
      .filter((code) => code !== undefined);
    expect(postalCodes).toEqual(["530-0001", "100-0001"]);
    expect(screen.getByText("大阪府大阪市北区梅田")).toBeInTheDocument();
    expect(screen.getByText("大阪府大阪市北区中之島")).toBeInTheDocument();
    expect(screen.getByText("東京都千代田区千代田")).toBeInTheDocument();
  });

  // The list is not mounted while closed, so there is nothing to point at
  // until it opens. The chevron beside the label is decoration, so the name
  // stays the label alone.
  test("points the control at the opened list, keeping its name", async () => {
    const user = userEvent.setup();
    render(<HistoryList entries={[firstEntry]} />);
    const control = screen.getByRole("button", { name: "履歴を展開" });
    expect(control).not.toHaveAttribute("aria-controls");

    await user.click(control);

    // The outer list is the history; each entry nests its own address list.
    const [historyList] = screen.getAllByRole("list");
    expect(historyList?.id).not.toBe("");
    expect(control).toHaveAttribute("aria-controls", historyList?.id);
    expect(control).toHaveAccessibleName("履歴を展開");
  });

  test("closes the list again when the control is activated a second time", async () => {
    const user = userEvent.setup();
    render(<HistoryList entries={[firstEntry]} />);

    await user.click(screen.getByRole("button", { name: "履歴を展開" }));
    await user.click(screen.getByRole("button", { name: "履歴を展開" }));

    expect(screen.getByRole("button", { name: "履歴を展開" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText("東京都千代田区千代田")).not.toBeInTheDocument();
  });
});
