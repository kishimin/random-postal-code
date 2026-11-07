import { render, screen } from "@testing-library/react";
import type { Address } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { AddressList } from "./AddressList";

const addresses: Address[] = [
  { prefecture: "東京都", city: "千代田区", town: "千代田" },
  { prefecture: "大阪府", city: "大阪市北区", town: "梅田" },
];

describe("AddressList", () => {
  test("renders every address in source order", () => {
    render(<AddressList addresses={addresses} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("東京都千代田区千代田");
    expect(items[1]).toHaveTextContent("大阪府大阪市北区梅田");
  });

  // Issue #99: the dataset gives an empty town where Japan Post wrote a
  // placeholder, and the address then reads as prefecture and city only.
  test("renders an address with an empty town as prefecture and city, with no separator after them", () => {
    render(
      <AddressList
        addresses={[{ prefecture: "埼玉県", city: "草加市", town: "" }]}
      />,
    );

    expect(screen.getByRole("listitem").textContent).toBe("埼玉県草加市");
  });

  // Issue #8 renders a per-address map action inside that same address's own
  // entry (acceptance/pages/address-map-page.ts scopes its locators that
  // way). AddressList stays feature-pure by accepting the content rather
  // than importing anything about maps itself.
  test("renders the given extra content inside each address's own entry", () => {
    render(
      <AddressList
        addresses={addresses}
        renderAddressExtra={(address) => <span>{`extra:${address.town}`}</span>}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("extra:千代田");
    expect(items[1]).toHaveTextContent("extra:梅田");
  });

  // Issue #111: each address reads as its text first, then its actions.
  test("puts the address text before the extra content", () => {
    render(
      <AddressList
        addresses={addresses}
        renderAddressExtra={(address) => <span>{`extra:${address.town}`}</span>}
      />,
    );

    expect(screen.getAllByRole("listitem")[0]?.textContent).toBe(
      "東京都千代田区千代田extra:千代田",
    );
  });
});
