import { render, screen } from "@testing-library/react";
import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { HistoryItem } from "./HistoryItem";

const entry: PostalCode = {
  postalCode: "9800000",
  addresses: [
    { prefecture: "宮城県", city: "仙台市青葉区", town: "一番町" },
    { prefecture: "宮城県", city: "仙台市青葉区", town: "大町" },
  ],
};

describe("HistoryItem", () => {
  // Figma opens the whole list with 履歴を展開, and an opened entry shows every
  // address of its postal code (ui-design.md section 9.2), so the entry has no
  // expand control of its own and every stored address is reachable.
  test("shows the postal code and every address of the entry", () => {
    render(<HistoryItem entry={entry} />);

    expect(screen.getByText("980-0000")).toBeInTheDocument();
    for (const address of entry.addresses) {
      expect(
        screen.getByText(`${address.prefecture}${address.city}${address.town}`),
      ).toBeInTheDocument();
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // Issue #99: an empty town, where Japan Post wrote a placeholder, reads as
  // prefecture and city only. HistoryItem composes its own address string.
  test("shows an address with an empty town as prefecture and city, with no separator after them", () => {
    render(
      <HistoryItem
        entry={{
          postalCode: "3400000",
          addresses: [{ prefecture: "埼玉県", city: "草加市", town: "" }],
        }}
      />,
    );

    // The entry itself is a listitem too; the address is the list inside it.
    const addressList = screen.getByRole("list");
    expect(addressList.textContent).toBe("埼玉県草加市");
  });
});
