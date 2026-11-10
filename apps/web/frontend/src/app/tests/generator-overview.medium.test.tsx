import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { PostalCode } from "@zipnami/shared";
import { HttpResponse, http } from "msw";
import { describe, expect, test } from "vitest";
import { worker } from "../../api/mocks/browser";
import { generateActionName } from "../../tests/generator-controls";
import { createAppRouter } from "../routes/app-router";

/*
 * ui-design.md section 5.5: while the generator shows no result, two sections
 * follow the start card, and once a result is shown both are removed. Rendered
 * through the production routes (ADR-0011), as a visitor reaches them.
 */
const RANDOM_ENDPOINT = "http://localhost:8787/api/random";

const result: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

const learnMoreGuides = [
  { name: "郵便番号のしくみ", href: "/guide/postal-code" },
  { name: "郵便番号と住所", href: "/guide/address" },
  { name: "データについて", href: "/guide/data" },
  { name: "使い方", href: "/guide/how-to-use" },
] as const;

const renderGenerator = () =>
  render(
    <RouterProvider
      router={createAppRouter(createMemoryHistory({ initialEntries: ["/"] }))}
    />,
  );

/** Answers the first `GET /api/random` with a failure and the next with a result. */
const failOnceThenSucceed = () => {
  const requests: string[] = [];

  worker.use(
    http.get(RANDOM_ENDPOINT, ({ request }) => {
      requests.push(request.url);

      return requests.length === 1
        ? HttpResponse.json(
            {
              error: {
                code: "DATA_UNAVAILABLE",
                message: "Postal code data is temporarily unavailable.",
                requestId: "01JEXAMPLE0000000000000000",
              },
            },
            { status: 503 },
          )
        : HttpResponse.json(result);
    }),
  );
};

const capabilities = () =>
  screen.getByRole("region", { name: "Zipnamiでできること" });

const learnMore = () =>
  screen.getByRole("region", { name: "郵便番号をもっと知る" });

describe("the generator's overview", () => {
  test("before any generation, Zipnamiでできること names the three capabilities under its own h2", async () => {
    renderGenerator();
    await screen.findByRole("button", { name: generateActionName });

    const region = within(capabilities());

    expect(
      region.getByRole("heading", { level: 2, name: "Zipnamiでできること" }),
    ).toBeVisible();
    expect(region.getAllByRole("listitem")).toHaveLength(3);
    // Each capability is held as a word a visitor cannot describe it without.
    for (const word of ["ランダム", "地図", "コピー", "履歴"]) {
      expect(capabilities(), word).toHaveTextContent(word);
    }
  });

  test("before any generation, 郵便番号をもっと知る links the four guides by their own names, and not /about", async () => {
    renderGenerator();
    await screen.findByRole("button", { name: generateActionName });

    const region = within(learnMore());
    const links = region.getAllByRole("link");

    expect(
      region.getByRole("heading", { level: 2, name: "郵便番号をもっと知る" }),
    ).toBeVisible();
    expect(links.map((link) => link.textContent)).toEqual(
      learnMoreGuides.map(({ name }) => name),
    );
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      learnMoreGuides.map(({ href }) => href),
    );
  });

  test("the generate action stays the first control in main, ahead of the overview", async () => {
    renderGenerator();
    await screen.findByRole("button", { name: generateActionName });

    const [firstControl] =
      // Testing Library has no query for "the first focusable element in a
      // container"; document order is exactly what is being held.
      // eslint-disable-next-line testing-library/no-node-access -- see above
      screen.getByRole("main").querySelectorAll("a[href], button");

    expect(firstControl).toBe(
      within(screen.getByRole("main")).getByRole("button", {
        name: generateActionName,
      }),
    );
  });

  test("a first generation that fails with no result leaves the overview in place", async () => {
    failOnceThenSucceed();
    const user = userEvent.setup();
    renderGenerator();

    await user.click(
      await screen.findByRole("button", { name: generateActionName }),
    );
    await screen.findByRole("button", { name: "再試行する" });

    expect(capabilities()).toBeVisible();
    expect(learnMore()).toBeVisible();
  });

  test("once a result is shown both sections are removed", async () => {
    failOnceThenSucceed();
    const user = userEvent.setup();
    renderGenerator();

    await user.click(
      await screen.findByRole("button", { name: generateActionName }),
    );
    await user.click(await screen.findByRole("button", { name: "再試行する" }));
    await screen.findByRole("button", { name: "もう一度、波に乗る" });

    expect(
      screen.queryByRole("region", { name: "Zipnamiでできること" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "郵便番号をもっと知る" }),
    ).not.toBeInTheDocument();
  });
});
