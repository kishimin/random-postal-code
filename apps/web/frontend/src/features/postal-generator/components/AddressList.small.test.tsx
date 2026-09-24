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

  // Issue #8 renders a per-address map action inside that same address's own
  // entry (acceptance/pages/address-map-page.ts scopes its locators that
  // way). AddressList stays feature-pure by accepting the content rather
  // than importing anything about maps itself.
  test("renders the given extra content inside each address's own entry", () => {
    render(
      <AddressList
        addresses={addresses}
        renderAddressExtra={(address) => (
          <span>{`extra:${address.town}`}</span>
        )}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("extra:千代田");
    expect(items[1]).toHaveTextContent("extra:梅田");
  });
});
