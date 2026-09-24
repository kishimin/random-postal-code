import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { PostalCode } from "@zipnami/shared";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { worker } from "../../api/mocks/browser";
import { createAppRouter } from "../routes/app-router";

/*
 * Covers Issue #8's own wiring inside GeneratorView: the maps feature's
 * components are unit-tested on their own (features/maps/**), but only
 * GeneratorView connects "which address is selected" to both the address
 * list's own action and the map region, so that connection needs its own
 * test.
 *
 * This suite never configures VITE_GOOGLE_MAPS_API_KEY (vite.config.ts's
 * test env only sets VITE_API_BASE_URL), so AddressMap always renders its
 * fallback rather than a real `<iframe>` -- design.md section 7 treats a
 * missing key as a map failure like any other, and that is what keeps this
 * Vitest suite from ever making a real request to Google, unlike the
 * Playwright acceptance test, which stubs the network boundary instead.
 */

const RANDOM_ENDPOINT = "http://localhost:8787/api/random";

const result: PostalCode = {
  postalCode: "1000001",
  addresses: [
    { prefecture: "東京都", city: "千代田区", town: "千代田" },
    { prefecture: "東京都", city: "千代田区", town: "丸の内" },
  ],
};

const renderApp = () => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: ["/"] }),
  );
  return render(<RouterProvider router={router} />);
};

const generate = async () => {
  const user = userEvent.setup();
  worker.use(
    http.get(RANDOM_ENDPOINT, () => HttpResponse.json(result)),
  );

  renderApp();
  await screen.findByRole("heading", { name: /Zipnami/, level: 1 });
  await user.click(screen.getByRole("button", { name: /生成/ }));
  await screen.findByRole("heading", { name: "地図" });

  return user;
};

describe("the maps experience", () => {
  // ui-design.md section 7: the region may be absent before a result exists.
  test("shows no map region before a result exists", () => {
    renderApp();

    expect(
      screen.queryByRole("heading", { name: "地図" }),
    ).not.toBeInTheDocument();
  });

  // ui-design.md section 5.3: "The first address is the initial map
  // selection." No key is configured here, so the map region shows its
  // fallback for that address instead of an iframe.
  test("shows the map region for the first address once a result exists", async () => {
    await generate();

    const mapRegion = screen.getByRole("heading", { name: "地図" })
      .closest("section")!;
    expect(
      within(mapRegion).getByText("東京都千代田区千代田"),
    ).toBeInTheDocument();
  });

  // ui-design.md section 5.3: "Selecting another address changes only the
  // map target, not the current result or history."
  test("selecting another address's map action moves the map region to it, leaving the result unchanged", async () => {
    const user = await generate();

    await user.click(
      screen.getByRole("button", { name: /丸の内.*地図/ }),
    );

    const mapRegion = screen.getByRole("heading", { name: "地図" })
      .closest("section")!;
    expect(within(mapRegion).getByText("東京都千代田区丸の内")).toBeInTheDocument();
    expect(within(mapRegion).queryByText("東京都千代田区千代田")).not.toBeInTheDocument();

    // The result itself -- outside the map region -- still lists both
    // addresses, unaffected by which one the map is showing. Scoped to the
    // address list itself: the map region's own fallback repeats the
    // selected address's text, which would otherwise make either query match
    // two elements.
    const addressList = screen.getByRole("list");
    expect(within(addressList).getByText("東京都千代田区千代田")).toBeInTheDocument();
    expect(within(addressList).getByText("東京都千代田区丸の内")).toBeInTheDocument();
  });
});
