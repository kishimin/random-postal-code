import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Address } from "@zipnami/shared";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mapsText } from "../site-text";
import { AddressMap, MAP_LOAD_TIMEOUT_MS } from "./AddressMap";

const address: Address = {
  prefecture: "東京都",
  city: "千代田区",
  town: "千代田",
};

// design.md section 7 and ui-design.md section 11 keep this a controlled
// substitute rather than a real Google Maps request: only the src-building
// boundary is replaced, so the fallback's own external link (built from the
// real module) still exercises real encoding.
vi.mock("../lib/map-url", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/map-url")>();
  return { ...actual, buildEmbedSrc: () => "about:blank" };
});

type ObserverEntry = { isIntersecting: boolean };

/**
 * Replaces the browser's IntersectionObserver so "the map region has
 * scrolled into view" is a fact this suite sets directly, instead of a real
 * viewport geometry and timing this browser-mode test would otherwise
 * depend on (mirrors acceptance/pages/address-map-page.ts's own
 * `revealMap()`, which triggers the same production lazy-load by scrolling).
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  private readonly callback: (entries: ObserverEntry[]) => void;
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();

  constructor(callback: (entries: ObserverEntry[]) => void) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }]);
  }
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const revealLatestObserver = () => {
  const observer = FakeIntersectionObserver.instances.at(-1);
  if (!observer) throw new Error("No IntersectionObserver was created.");
  act(() => observer.trigger(true));
};

describe("AddressMap", () => {
  test("reserves the map region without loading the frame before it scrolls into view", () => {
    render(<AddressMap address={address} apiKey={"test-key"} />);

    expect(
      screen.queryByTitle(mapsText.embedTitle(address)),
    ).not.toBeInTheDocument();
  });

  test("loads the embedded map once the region scrolls into view", () => {
    render(<AddressMap address={address} apiKey={"test-key"} />);

    revealLatestObserver();

    expect(screen.getByTitle(mapsText.embedTitle(address))).toHaveAttribute(
      "src",
      "about:blank",
    );
  });

  // design.md section 7: Maps is an optional dependency; a build with no
  // configured key must not attempt a request doomed to fail.
  test("shows the fallback instead of ever loading a frame when no API key is configured", () => {
    render(<AddressMap address={address} apiKey={""} />);

    // No IntersectionObserver is even created: design.md section 7 treats a
    // missing key as an immediate failure, not something worth watching for
    // visibility first.
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
    expect(
      screen.queryByTitle(mapsText.embedTitle(address)),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(`${address.prefecture}${address.city}${address.town}`),
    ).toBeInTheDocument();
  });

  // ui-design.md section 7: a map failure shows the fallback -- the Issue's
  // "leaves the result usable" criterion depends on this for network
  // failures. A real browser does not reliably fire the iframe's own error
  // event for a navigation that never completes (the Page Object's own
  // comment on why "rejected" -- an HTTP error response that still finishes
  // loading a document -- is unobservable makes the same point from the
  // other side), so a load that never completes is what this component can
  // actually detect, via a timeout instead.
  test("shows the fallback once the frame has not finished loading after the timeout", () => {
    vi.useFakeTimers();
    render(<AddressMap address={address} apiKey={"test-key"} />);
    revealLatestObserver();

    act(() => {
      vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS);
    });

    expect(
      screen.queryByTitle(mapsText.embedTitle(address)),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(`${address.prefecture}${address.city}${address.town}`),
    ).toBeInTheDocument();
  });

  test("keeps the frame once it loads before the timeout elapses", () => {
    vi.useFakeTimers();
    render(<AddressMap address={address} apiKey={"test-key"} />);
    revealLatestObserver();

    act(() => {
      fireEvent.load(screen.getByTitle(mapsText.embedTitle(address)));
      vi.advanceTimersByTime(MAP_LOAD_TIMEOUT_MS);
    });

    expect(
      screen.getByTitle(mapsText.embedTitle(address)),
    ).toBeInTheDocument();
  });
});
