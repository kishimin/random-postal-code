import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AdvertisingRegion } from "./AdvertisingRegion";

describe("AdvertisingRegion", () => {
  // acceptance/selectors/advertising-selectors.ts's regionLabel: located by an
  // accessible label rather than only colour (ui-design.md sections 7 and 8).
  test("renders exactly one labeled advertising region", () => {
    render(
      <AdvertisingRegion
        clientId={"ca-pub-1234567890123456"}
        testMode={true}
      />,
    );

    const regions = screen.getAllByRole("region", { name: /広告/ });
    expect(regions).toHaveLength(1);
    expect(regions[0]).toBeVisible();
  });

  test("carries the AdSense display unit inside the labeled region", () => {
    render(
      <AdvertisingRegion
        clientId={"ca-pub-1234567890123456"}
        testMode={true}
      />,
    );

    const region = screen.getByRole("region", { name: /広告/ });
    expect(
      within(region).getByTestId("advertising-ad-slot"),
    ).toBeInTheDocument();
  });

  // ui-design.md section 7: a failed or unfilled ad must never leave behind a
  // control a visitor could mistake for one of Zipnami's own actions.
  test("carries none of the application's own interactive controls", () => {
    render(
      <AdvertisingRegion
        clientId={"ca-pub-1234567890123456"}
        testMode={true}
      />,
    );

    const region = screen.getByRole("region", { name: /広告/ });
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
  });

  test("forwards the client ID and test-ad configuration to the AdSense slot", () => {
    render(
      <AdvertisingRegion
        clientId={"ca-pub-9999999999999999"}
        testMode={false}
      />,
    );

    const slot = screen.getByTestId("advertising-ad-slot");
    expect(slot).toHaveAttribute("data-ad-client", "ca-pub-9999999999999999");
    expect(slot).not.toHaveAttribute("data-adtest");
  });
});
