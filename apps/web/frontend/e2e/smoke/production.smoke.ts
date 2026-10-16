import { expect, test } from "@playwright/test";

/*
 * Issue #19: "A production smoke check generates and displays a postal code
 * from Pages through Workers", plus the SPA fallback in production. Nothing
 * is stubbed: the page calls whatever Worker its build was given.
 */

test("the deployed site generates and displays a postal code through the Worker", async ({
  page,
}) => {
  await page.goto("/");

  const apiResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/api/random"),
  );
  await page.getByRole("button", { name: /生成/ }).click();

  // A CORS refusal or a Worker failure shows up here first, as a status
  // other than 200, before the page can say anything.
  const response = await apiResponse;

  expect(response.status()).toBe(200);
  // The page called a different origin than its own: the Worker, not a
  // Pages path that happens to end in /api/random.
  expect(new URL(response.url()).origin).not.toBe(new URL(page.url()).origin);

  // What is displayed is what the Worker returned, not a placeholder.
  const { postalCode } = (await response.json()) as { postalCode: string };

  await expect(
    page
      .getByRole("main")
      .getByText(`${postalCode.slice(0, 3)}-${postalCode.slice(3)}`, {
        exact: true,
      }),
  ).toBeVisible();
});

test("a deep link and a refresh both reach the page rather than a 404", async ({
  page,
}) => {
  const direct = await page.goto("/privacy");

  expect(direct?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "プライバシーポリシー", level: 1 }),
  ).toBeVisible();

  const refreshed = await page.reload();

  expect(refreshed?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "プライバシーポリシー", level: 1 }),
  ).toBeVisible();
});

// Issue #38: the script policy from public/_headers has to reach every
// document Pages serves. A deep link is answered through the SPA rewrite in
// public/_redirects, and Cloudflare documents that "the redirect will win
// out" when both files match. Locally (wrangler pages dev) a 200 rewrite
// still carries the header; this checks the same in production.
test("the root and a deep link both carry the script policy", async ({
  request,
}) => {
  for (const pathname of ["/", "/privacy"]) {
    const response = await request.get(pathname);
    const policy =
      response.headers()["content-security-policy-report-only"] ??
      response.headers()["content-security-policy"];

    expect({ pathname, policy }).toEqual({
      pathname,
      policy: expect.stringContaining("script-src"),
    });
  }
});
