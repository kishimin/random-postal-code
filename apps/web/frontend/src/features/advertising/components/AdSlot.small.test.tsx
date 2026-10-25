import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AdSlot } from "./AdSlot";

// AdSlot.tsx's own AdsenseWindow type is not exported: it is an internal
// detail of how the component reaches the real SDK's queue, and these tests
// only need enough of the shape to install a substitute for it.
type AdsensePushWindow = Window & {
  adsbygoogle?: { push: (command: unknown) => void };
};

describe("AdSlot", () => {
  afterEach(() => {
    // The real AdSense SDK replaces window.adsbygoogle for the lifetime of the
    // page; a substitute installed by one test must not leak into the next.
    delete (window as AdsensePushWindow).adsbygoogle;
  });

  // acceptance/selectors/advertising-selectors.ts's adSlotSelector: AdSense's
  // own placement contract is an <ins class="adsbygoogle"> element, not
  // Zipnami's own markup.
  test("renders exactly one AdSense display unit for the given client and slot", () => {
    render(
      <AdSlot
        clientId={"ca-pub-1234567890123456"}
        slotId={"1111111111"}
        testMode={false}
      />,
    );

    const slots = screen.getAllByTestId("advertising-ad-slot");
    expect(slots).toHaveLength(1);
    expect(slots[0]).toHaveAttribute(
      "data-ad-client",
      "ca-pub-1234567890123456",
    );
    expect(slots[0]).toHaveAttribute("data-ad-slot", "1111111111");
  });

  // acceptance/selectors/advertising-selectors.ts's testAdSlotSelector:
  // `data-adtest="on"` is AdSense's documented way to ask for test ads.
  test("asks for test ads when testMode is true", () => {
    render(
      <AdSlot
        clientId={"ca-pub-1234567890123456"}
        slotId={"1111111111"}
        testMode={true}
      />,
    );

    expect(screen.getByTestId("advertising-ad-slot")).toHaveAttribute(
      "data-adtest",
      "on",
    );
  });

  test("does not ask for test ads when testMode is false", () => {
    render(
      <AdSlot
        clientId={"ca-pub-1234567890123456"}
        slotId={"1111111111"}
        testMode={false}
      />,
    );

    expect(screen.getByTestId("advertising-ad-slot")).not.toHaveAttribute(
      "data-adtest",
    );
  });

  // AdSlot.tsx's own docstring: this push is "safe to call before, during, or
  // instead of a successful load" -- which only holds if the effect actually
  // performs it. Deleting the push call would leave every test above green.
  test("pushes the slot to window.adsbygoogle exactly once on mount", () => {
    const push = vi.fn<(command: unknown) => void>();
    (window as AdsensePushWindow).adsbygoogle = { push };

    render(
      <AdSlot
        clientId={"ca-pub-1234567890123456"}
        slotId={"1111111111"}
        testMode={false}
      />,
    );

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({});
  });

  // The real AdSense SDK can throw synchronously from push() -- for example
  // when a second mount of this component (a route revisited) pushes to a
  // `<ins>` the SDK already filled, or when the slot has no available width to
  // size against. An effect that lets that exception escape crashes the whole
  // component tree up to the nearest error boundary, which contradicts this
  // hook's own contract that a failure here never reaches it.
  test("keeps rendering the ad unit even when window.adsbygoogle.push throws", () => {
    (window as AdsensePushWindow).adsbygoogle = {
      push: () => {
        throw new Error("adsbygoogle push failed");
      },
    };

    expect(() =>
      render(
        <AdSlot
          clientId={"ca-pub-1234567890123456"}
          slotId={"1111111111"}
          testMode={false}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId("advertising-ad-slot")).toBeInTheDocument();
  });
});
