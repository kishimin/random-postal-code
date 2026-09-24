import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { PostalCode } from "@zipnami/shared";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, test } from "vitest";
import { worker } from "../../api/mocks/browser";
import { createAppRouter } from "../routes/app-router";

/*
 * Component/integration coverage for Issue #7, alongside
 * generator-experience.medium.test.tsx's coverage of Issue #6 -- ordering,
 * limit enforcement, duplicate retention, and persistence, exercised through
 * the production route composition rather than a hook or component mounted
 * on its own. "Invalid stored state" is deliberately not repeated here: it is
 * a storage-layer concern already proven directly against the browser's own
 * localStorage in history-storage.medium.test.ts, where seeding a corrupt
 * value does not require driving a whole page render to observe.
 */

const RANDOM_ENDPOINT = "http://localhost:8787/api/random";

const firstResult: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondResult: PostalCode = {
  postalCode: "5300001",
  addresses: [{ prefecture: "大阪府", city: "大阪市北区", town: "梅田" }],
};

/**
 * Queues answers for `GET /api/random`, repeating the last one once the
 * queue is down to it -- mirrors generator-experience.medium.test.tsx's own
 * helper.
 */
const queueRandomResponses = (results: PostalCode[]) => {
  const queue = [...results];

  worker.use(
    http.get(RANDOM_ENDPOINT, () => {
      const next = queue.length > 1 ? queue.shift() : queue.at(0);
      return HttpResponse.json(next);
    }),
  );
};

const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return render(<RouterProvider router={router} />);
};

const historyPostalCodes = () =>
  screen
    .getAllByRole("listitem")
    .map((item) => item.textContent?.match(/\d{3}-\d{4}/)?.at(0))
    .filter((code): code is string => code !== undefined);

// Scoped to the current-result region rather than the whole page: once
// history renders, the same postal code legitimately appears a second time
// as a history entry (HistoryItem always shows its own postal code), and an
// unscoped query would then match both.
const currentResultText = (postalCode: string) =>
  within(screen.getByTestId("result-region")).findByText(postalCode);

describe("the generation history experience", () => {
  beforeEach(() => localStorage.clear());

  // design.md section 6.2: newest first.
  test("prepends each successful generation to the beginning of history", async () => {
    const user = userEvent.setup();
    queueRandomResponses([firstResult, secondResult]);
    renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));
    expect(await currentResultText("100-0001")).toBeInTheDocument();
    expect(historyPostalCodes()).toEqual(["100-0001"]);

    await user.click(screen.getByRole("button", { name: /生成/ }));
    await currentResultText("530-0001");

    expect(historyPostalCodes()).toEqual(["530-0001", "100-0001"]);
  });

  // design.md section 6.2: "retaining duplicates".
  test("keeps the same postal code generated twice as two separate entries", async () => {
    const user = userEvent.setup();
    queueRandomResponses([firstResult, firstResult]);
    renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));
    await currentResultText("100-0001");
    await user.click(screen.getByRole("button", { name: /生成/ }));

    // Both entries render with the same text, so waiting for the count to
    // settle at two is what distinguishes a real second entry from the
    // first one simply not having disappeared yet.
    await expect
      .poll(() => historyPostalCodes())
      .toEqual(["100-0001", "100-0001"]);
  });

  // design.md section 6.2's persistence requirement. A real reload is not
  // reproducible in this environment, so a fresh router mount over the same
  // localStorage stands in for one, the same boundary
  // history-storage.medium.test.ts exercises directly.
  test("keeps history after the generator remounts", async () => {
    const user = userEvent.setup();
    queueRandomResponses([firstResult, secondResult]);
    const { unmount } = renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));
    await currentResultText("100-0001");
    await user.click(screen.getByRole("button", { name: /生成/ }));
    await currentResultText("530-0001");
    unmount();

    renderAt("/");

    await expect
      .poll(() => historyPostalCodes())
      .toEqual(["530-0001", "100-0001"]);
  });
});
