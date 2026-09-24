import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AdSlot } from "./AdSlot";

describe("AdSlot", () => {
  // acceptance/selectors/advertising-selectors.ts's adSlotSelector: AdSense's
  // own placement contract is an <ins class="adsbygoogle"> element, not
  // Zipnami's own markup.
  test("renders exactly one AdSense display unit for the given client and slot", () => {
    const { container } = render(
      <AdSlot clientId={"ca-pub-1234567890123456"} slotId={"1111111111"} testMode={false} />,
    );

    const slots = container.querySelectorAll("ins.adsbygoogle");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toHaveAttribute("data-ad-client", "ca-pub-1234567890123456");
    expect(slots[0]).toHaveAttribute("data-ad-slot", "1111111111");
  });

  // acceptance/selectors/advertising-selectors.ts's testAdSlotSelector:
  // `data-adtest="on"` is AdSense's documented way to ask for test ads.
  test("asks for test ads when testMode is true", () => {
    const { container } = render(
      <AdSlot clientId={"ca-pub-1234567890123456"} slotId={"1111111111"} testMode={true} />,
    );

    expect(container.querySelector("ins.adsbygoogle")).toHaveAttribute(
      "data-adtest",
      "on",
    );
  });

  test("does not ask for test ads when testMode is false", () => {
    const { container } = render(
      <AdSlot clientId={"ca-pub-1234567890123456"} slotId={"1111111111"} testMode={false} />,
    );

    expect(container.querySelector("ins.adsbygoogle")).not.toHaveAttribute(
      "data-adtest",
    );
  });
});
