import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { PostalCode } from "@zipnami/shared";
import { HttpResponse, delay, http } from "msw";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { worker } from "../../api/mocks/browser";
import { generateActionName } from "../../tests/generator-controls";
import { createAppRouter } from "../routes/app-router";

/*
 * Issue #120 (ui-design.md section 7.1): only the generator route while it
 * shows a result may request an ad -- load the AdSense loader, render an
 * `ins.adsbygoogle` unit, or push onto `adsbygoogle`. Every other route and
 * state does none of the three.
 *
 * Rendered through the production route configuration so each row of the
 * contract's table is exercised as a visitor reaches it.
 */

const RANDOM_ENDPOINT = "http://localhost:8787/api/random";

const result: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createAppRouter(createMemoryHistory({ initialEntries: [path] }))}
    />,
  );

/** Waits past one render-and-effect cycle so a deferred request would have run. */
const flushEffects = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const loaderScripts = () =>
  // The loader is appended to document.head outside any React tree, so
  // Testing Library has no query for it.
  // eslint-disable-next-line testing-library/no-node-access -- see above
  Array.from(document.head.querySelectorAll('script[src*="adsbygoogle.js"]'));

/** What the page has pushed onto the AdSense queue, if it has one at all. */
const adPushes = (): unknown[] => {
  const queue: unknown = Reflect.get(window, "adsbygoogle");
  return Array.isArray(queue) ? queue : [];
};

const resetAdState = () => {
  Reflect.deleteProperty(window, "adsbygoogle");
  loaderScripts().forEach((script) => {
    script.remove();
  });
};

const expectNoAdRequested = () => {
  expect(screen.queryByTestId("advertising-ad-slot")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("region", { name: /広告/ }),
  ).not.toBeInTheDocument();
  expect(loaderScripts()).toHaveLength(0);
  expect(adPushes()).toHaveLength(0);
};

describe("ad eligibility (ui-design.md section 7.1)", () => {
  beforeEach(resetAdState);
  afterEach(resetAdState);

  test("the initial generator screen requests no ad", async () => {
    renderAt("/");
    await screen.findByRole("button", { name: generateActionName });
    await flushEffects();

    expectNoAdRequested();
  });

  test("the first generation's loading state requests no ad", async () => {
    worker.use(
      http.get(RANDOM_ENDPOINT, async () => {
        await delay("infinite");
        return HttpResponse.json(result);
      }),
    );
    const user = userEvent.setup();
    renderAt("/");

    await user.click(
      await screen.findByRole("button", { name: generateActionName }),
    );
    await flushEffects();

    expect(
      screen.getByRole("button", { name: generateActionName }),
    ).toBeDisabled();
    expectNoAdRequested();
  });

  test("an API failure with no result shown requests no ad", async () => {
    worker.use(
      http.get(RANDOM_ENDPOINT, () =>
        HttpResponse.json(
          {
            error: {
              code: "DATA_UNAVAILABLE",
              message: "Postal code data is temporarily unavailable.",
              requestId: "01JEXAMPLE0000000000000000",
            },
          },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderAt("/");

    await user.click(
      await screen.findByRole("button", { name: generateActionName }),
    );
    await screen.findByRole("button", { name: "再試行する" });
    await flushEffects();

    expectNoAdRequested();
  });
});
