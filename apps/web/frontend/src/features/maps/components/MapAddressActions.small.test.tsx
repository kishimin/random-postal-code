import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Address } from "@zipnami/shared";
import { describe, expect, test, vi } from "vitest";
import { MapAddressActions } from "./MapAddressActions";

const address: Address = {
  prefecture: "東京都",
  city: "千代田区",
  town: "千代田",
};

const otherAddress: Address = {
  prefecture: "東京都",
  city: "千代田区",
  town: "丸の内",
};

describe("MapAddressActions", () => {
  // acceptance/selectors/map-selectors.ts locates this control by /地図/, and
  // ui-design.md section 8 asks for an accessible name carrying enough
  // address context to tell one address's action from another's.
  test("offers a map-selection button whose accessible name names this address", () => {
    render(
      <MapAddressActions
        address={address}
        isSelected={false}
        onSelect={() => undefined}
      />,
    );

    const button = screen.getByRole("button", { name: /地図/ });
    expect(button.accessibleName).toContain(address.town);
    expect(button.accessibleName).not.toContain(otherAddress.town);
  });

  test("activating the map-selection button reports this address as selected", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <MapAddressActions
        address={address}
        isSelected={false}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /地図/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // ui-design.md section 5.3: every address provides a clearly named
  // external Google Maps link with an encoded full-address query.
  test("offers an external Google Maps link whose query encodes this address", () => {
    render(
      <MapAddressActions
        address={address}
        isSelected={false}
        onSelect={() => undefined}
      />,
    );

    const link = screen.getByRole("link");
    const href = link.getAttribute("href") ?? "";

    expect(new URL(href).searchParams.get("query")).toContain(address.town);
    expect(href.includes(address.town)).toBe(false);
  });

  // ui-design.md section 8: reflect selection in the accessibility tree, not
  // only visually.
  test("marks the button pressed when this address is the current map selection", () => {
    render(
      <MapAddressActions
        address={address}
        isSelected={true}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /地図/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
