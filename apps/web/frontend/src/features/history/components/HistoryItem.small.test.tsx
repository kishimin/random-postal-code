import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { historyText } from "../site-text";
import { HistoryItem } from "./HistoryItem";

const entry: PostalCode = {
  postalCode: "9800000",
  addresses: [
    { prefecture: "宮城県", city: "仙台市青葉区", town: "一番町" },
    { prefecture: "宮城県", city: "仙台市青葉区", town: "大町" },
  ],
};

describe("HistoryItem", () => {
  // ui-design.md section 5.4: every stored address stays reachable through an
  // explicit expand control, collapsed by default. Collapsing the postal
  // code's own address too (not only the addresses beyond the first) keeps a
  // superseded entry's address out of the DOM until a visitor asks for it --
  // random-postal-code-experience.medium.test.ts's own "regenerating" case
  // asserts a superseded address is gone from the whole page, which a
  // history that showed it by default would contradict.
  test("shows the postal code and hides every address until the expand control is activated", () => {
    render(<HistoryItem entry={entry} />);

    expect(screen.getByText("980-0000")).toBeInTheDocument();
    expect(screen.queryByText(/仙台市青葉区/)).not.toBeInTheDocument();

    const expandControl = screen.getByRole("button", {
      name: historyText.expandAddressesLabel,
    });
    expect(expandControl).toHaveAttribute("aria-expanded", "false");
  });

  test("reveals every address once the expand control is activated", async () => {
    const user = userEvent.setup();
    render(<HistoryItem entry={entry} />);

    await user.click(
      screen.getByRole("button", { name: historyText.expandAddressesLabel }),
    );

    for (const address of entry.addresses) {
      expect(
        screen.getByText(`${address.prefecture}${address.city}${address.town}`),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: historyText.collapseAddressesLabel }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  test("collapses the addresses again when the expand control is activated a second time", async () => {
    const user = userEvent.setup();
    render(<HistoryItem entry={entry} />);
    const toggle = () =>
      screen.getByRole("button", { name: /住所/ });

    await user.click(toggle());
    await user.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/仙台市青葉区/)).not.toBeInTheDocument();
  });
});
