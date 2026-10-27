import { render, screen } from "@testing-library/react";
import type { Address, PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { mapsText } from "../site-text";
import { MapSection } from "./MapSection";

const address: Address = {
  prefecture: "東京都",
  city: "千代田区",
  town: "千代田",
};

const result: PostalCode = { postalCode: "1000001", addresses: [address] };

describe("MapSection", () => {
  // ui-design.md section 7: "Before generation, the region may be absent
  // rather than displaying an empty iframe."
  test("renders nothing before a result exists", () => {
    const { container } = render(
      <MapSection result={undefined} selectedAddress={undefined} apiKey={""} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("renders a labeled map region once a result exists", () => {
    render(
      <MapSection result={result} selectedAddress={address} apiKey={""} />,
    );

    expect(
      screen.getByRole("heading", { name: mapsText.mapHeading }),
    ).toBeInTheDocument();
    // apiKey is deliberately "" here: exercising the real embed's iframe
    // belongs to AddressMap's own suite (map-url is a controlled substitute
    // there); this component's own contract is only whether the region
    // appears at all, already covered without touching that boundary.
    expect(
      screen.getByText(`${address.prefecture}${address.city}${address.town}`),
    ).toBeInTheDocument();
  });
});
