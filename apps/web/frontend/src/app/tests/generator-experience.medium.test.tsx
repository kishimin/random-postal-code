import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { Address, PostalCode } from "@zipnami/shared";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { worker } from "../../api/mocks/browser";
import { createAppRouter } from "../routes/app-router";

/*
 * Covers Issue #6's acceptance criterion "Component/integration tests assert
 * observable initial, loading, success, regeneration, copy, and failure
 * behavior" -- the one criterion acceptance/random-postal-code-experience
 * does not hold, because a browser cannot observe which test file a
 * repository's suite lives in (see that file's own header comment).
 *
 * Rendered through the production route configuration, as
 * routing.medium.test.tsx does, so this exercises the same composition a
 * visitor reaches rather than GeneratorView mounted on its own.
 */

const RANDOM_ENDPOINT = "http://localhost:8787/api/random";

const firstResult: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const secondResult: PostalCode = {
  postalCode: "5300001",
  addresses: [
    { prefecture: "大阪府", city: "大阪市北区", town: "梅田" },
    { prefecture: "大阪府", city: "大阪市北区", town: "中之島" },
  ],
};

const dataUnavailableBody = {
  error: {
    code: "DATA_UNAVAILABLE",
    message: "Postal code data is temporarily unavailable.",
    requestId: "01JEXAMPLE0000000000000000",
  },
};

type StubbedResponse =
  | { outcome: "success"; result: PostalCode }
  | { outcome: "unavailable" };

/**
 * Queues answers for `GET /api/random`, repeating the last one once the
 * queue is down to it -- mirrors the acceptance test's Page Object stub so
 * a caller only queues as many responses as it cares about.
 */
const queueRandomResponses = (responses: StubbedResponse[]) => {
  const queue = [...responses];
  const requests: string[] = [];

  worker.use(
    http.get(RANDOM_ENDPOINT, ({ request }) => {
      requests.push(request.url);
      const next = queue.length > 1 ? queue.shift() : queue.at(0);

      return next?.outcome === "success"
        ? HttpResponse.json(next.result)
        : HttpResponse.json(dataUnavailableBody, { status: 503 });
    }),
  );

  return { requests };
};

/**
 * Holds the response to `GET /api/random` until `resolve` is called, which
 * is how the loading state is reached without guessing a timer's length.
 */
const holdRandomResponse = () => {
  const requests: string[] = [];
  const controls = {
    resolve: undefined as unknown as (result: PostalCode) => void,
  };
  const held = new Promise<PostalCode>((resolve) => {
    controls.resolve = resolve;
  });

  worker.use(
    http.get(RANDOM_ENDPOINT, async ({ request }) => {
      requests.push(request.url);
      return HttpResponse.json(await held);
    }),
  );

  return {
    requests,
    resolve: (result: PostalCode) => {
      controls.resolve(result);
    },
  };
};

const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return render(<RouterProvider router={router} />);
};

const findAddressListItem = (address: Address) =>
  screen
    .getAllByRole("listitem")
    .find((item) =>
      [address.prefecture, address.city, address.town].every((part) =>
        item.textContent?.includes(part),
      ),
    );

/*
 * Records what the page hands to the platform clipboard instead of the real
 * clipboard, which needs a permission grant this suite does not hold.
 * Restores the original after the test, mirroring the acceptance test's own
 * Page Object stub at acceptance/pages/postal-code-generator-page.ts.
 */
const stubClipboardWrites = () => {
  const writes: string[] = [];
  const record = (text: string) => {
    writes.push(text);
    return Promise.resolve();
  };
  const original = navigator.clipboard.writeText;
  navigator.clipboard.writeText = record;

  return {
    writes,
    restore: () => {
      navigator.clipboard.writeText = original;
    },
  };
};

describe("the generator experience", () => {
  test("the initial screen offers branding, an explanation, and the generate action with an empty result and no request", async () => {
    const { requests } = queueRandomResponses([
      { outcome: "success", result: firstResult },
    ]);

    renderAt("/");

    expect(
      await screen.findByRole("heading", { name: /Zipnami/, level: 1 }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main"))
        .getAllByRole("paragraph")
        .some((paragraph) => /郵便番号/.test(paragraph.textContent ?? "")),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /生成/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d{3}-\d{4}/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /コピー/ }),
    ).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  test("the generate action is disabled while its request is in flight", async () => {
    const user = userEvent.setup();
    const { resolve } = holdRandomResponse();
    renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /生成/ })).toBeDisabled(),
    );

    resolve(firstResult);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /生成/ })).toBeEnabled(),
    );
  });

  test("activating the generate action displays the returned postal code and every returned address", async () => {
    const user = userEvent.setup();
    queueRandomResponses([{ outcome: "success", result: firstResult }]);
    renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));

    expect(await screen.findByText("100-0001")).toBeInTheDocument();
    for (const address of firstResult.addresses) {
      expect(findAddressListItem(address)).toBeDefined();
    }
  });

  test("regenerating replaces the current result with the newly returned one", async () => {
    const user = userEvent.setup();
    queueRandomResponses([
      { outcome: "success", result: firstResult },
      { outcome: "success", result: secondResult },
    ]);
    renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));
    expect(await screen.findByText("100-0001")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /生成/ }));

    expect(await screen.findByText("530-0001")).toBeInTheDocument();
    expect(screen.queryByText("100-0001")).not.toBeInTheDocument();
    for (const address of secondResult.addresses) {
      expect(findAddressListItem(address)).toBeDefined();
    }
  });

  test("the displayed postal code is copied to the clipboard as its canonical seven digits", async () => {
    const user = userEvent.setup();
    queueRandomResponses([{ outcome: "success", result: firstResult }]);
    const { writes, restore } = stubClipboardWrites();

    try {
      renderAt("/");
      await user.click(await screen.findByRole("button", { name: /生成/ }));
      await screen.findByText("100-0001");

      await user.click(screen.getByRole("button", { name: /コピー/ }));

      await waitFor(() => expect(writes).toContain("1000001"));
    } finally {
      restore();
    }
  });

  test("a failed generation is announced, keeps the previous result, and allows another attempt", async () => {
    const user = userEvent.setup();
    queueRandomResponses([
      { outcome: "success", result: firstResult },
      { outcome: "unavailable" },
      { outcome: "success", result: secondResult },
    ]);
    renderAt("/");

    await user.click(await screen.findByRole("button", { name: /生成/ }));
    expect(await screen.findByText("100-0001")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /生成/ }));

    // ui-design.md section 8 requires a request error to be announced; the
    // exact wording is this Issue's to choose (section 12), so this only
    // asserts that the live region says something.
    await waitFor(() =>
      expect(screen.getByRole("status").textContent?.trim()).not.toBe(""),
    );

    // design.md section 4: a failure keeps the previous result on screen.
    expect(screen.getByText("100-0001")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /生成/ }));

    expect(await screen.findByText("530-0001")).toBeInTheDocument();
  });
});
