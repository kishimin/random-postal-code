import { render, screen } from "@testing-library/react";
import type { Address } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { MapFallback } from "./MapFallback";

const address: Address = {
  prefecture: "東京都",
  city: "千代田区",
  town: "千代田",
};

describe("MapFallback", () => {
  // ui-design.md section 7: "A map failure shows a fallback with the
  // selected address and external link."
  test("shows the selected address's full text", () => {
    render(<MapFallback address={address} />);

    expect(
      screen.getByText(`${address.prefecture}${address.city}${address.town}`),
    ).toBeInTheDocument();
  });

  test("offers an external Google Maps link whose query encodes the address", () => {
    render(<MapFallback address={address} />);

    const link = screen.getByRole("link");
    expect(link).toBeVisible();

    const href = link.getAttribute("href") ?? "";
    expect(new URL(href).searchParams.get("query")).toContain(address.town);
    // The criterion asks for an encoded query: the raw attribute must not
    // carry the address literally.
    expect(href.includes(address.town)).toBe(false);
  });
});
