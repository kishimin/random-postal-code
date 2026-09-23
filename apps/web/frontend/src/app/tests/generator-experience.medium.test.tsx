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
  { outcome: "success"; result: PostalCode } | { outcome: "unavailable" };

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

/**
 * Waits past one full render-and-effect cycle so a passive effect that would
 * have run already has -- there is no forward-looking condition to poll for
 * when the assertion that follows is that nothing happened.
 */
const flushEffects = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

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
  const original = navigator.clipboard.writeText.bind(navigator.clipboard);
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
    expect(screen.getByRole("button", { name: /生成/ })).toBeInTheDocument();
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

  // ui-design.md section 8: "Set aria-busy on the result region during
  // generation."
  test("marks the result region busy while a generation is in flight, and not otherwise", async () => {
    const user = userEvent.setup();
    const { resolve } = holdRandomResponse();
    renderAt("/");
    const generateButton = await screen.findByRole("button", { name: /生成/ });
    const main = screen.getByRole("main");

    expect(main.querySelector("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );

    await user.click(generateButton);

    await waitFor(() =>
      expect(main.querySelector("[aria-busy]")).toHaveAttribute(
        "aria-busy",
        "true",
      ),
    );

    resolve(firstResult);

    await waitFor(() =>
      expect(main.querySelector("[aria-busy]")).toHaveAttribute(
        "aria-busy",
        "false",
      ),
    );
  });

  // A result arriving must not take focus away from the action that asked
  // for it (acceptance/random-postal-code-experience.medium.test.ts's
  // keyboard scenario), even though the action was disabled -- and so lost
  // focus -- while the request it started was in flight.
  test("keeps focus on the generate action once a result arrives, even though the action was disabled meanwhile", async () => {
    const user = userEvent.setup();
    const { resolve } = holdRandomResponse();
    renderAt("/");
    const generateButton = await screen.findByRole("button", { name: /生成/ });

    await user.click(generateButton);
    await waitFor(() => expect(generateButton).toBeDisabled());

    resolve(firstResult);

    await waitFor(() => expect(generateButton).toBeEnabled());
    // Restoring focus runs in an effect once the button re-enables, which
    // this test does not otherwise wait on the way it waits on state
    // reaching the DOM -- toBeEnabled() can already be true a tick before
    // that effect runs.
    await waitFor(() => expect(generateButton).toHaveFocus());
  });

  // The generate action losing focus while disabled must only be restored
  // when nothing else has since claimed it. Regenerating with an existing
  // result on screen disables (and defocuses) the action the same way, but
  // this time the visitor has moved on with the keyboard before the result
  // arrives -- pulling focus back would silently cancel that navigation.
  test("does not pull focus back to the generate action once loading ends if the user already tabbed elsewhere", async () => {
    const user = userEvent.setup();
    queueRandomResponses([{ outcome: "success", result: firstResult }]);
    renderAt("/");
    const generateButton = await screen.findByRole("button", { name: /生成/ });

    await user.click(generateButton);
    expect(await screen.findByText("100-0001")).toBeInTheDocument();

    const { resolve } = holdRandomResponse();
    await user.click(generateButton);
    await waitFor(() => expect(generateButton).toBeDisabled());

    // Focus landed on document.body the instant the button disabled itself;
    // tabbing from there reaches the header's home link first, then the
    // copy action -- the generate action is skipped because it is disabled.
    await user.tab();
    await user.tab();
    const copyButton = screen.getByRole("button", { name: /コピー/ });
    expect(copyButton).toHaveFocus();

    resolve(secondResult);

    await waitFor(() => expect(generateButton).toBeEnabled());
    await flushEffects();
    expect(copyButton).toHaveFocus();
    expect(generateButton).not.toHaveFocus();
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
    // Recorded before the retry: the live region already carries the first
    // success's announcement, so waiting only for "non-empty" would be
    // satisfied by that leftover text the instant the click handler returns
    // -- before the failure this test is about ever reaches the DOM.
    const announcedBeforeRetry = screen.getByRole("status").textContent?.trim();

    await user.click(screen.getByRole("button", { name: /生成/ }));

    // ui-design.md section 8 requires a request error to be announced; the
    // exact wording is this Issue's to choose (section 12), so this only
    // asserts that the live region says something new.
    await waitFor(() => {
      const announced = screen.getByRole("status").textContent?.trim();
      expect(announced).not.toBe("");
      expect(announced).not.toBe(announcedBeforeRetry);
    });

    // design.md section 4: a failure keeps the previous result on screen.
    expect(screen.getByText("100-0001")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /生成/ }));

    expect(await screen.findByText("530-0001")).toBeInTheDocument();
  });
});
