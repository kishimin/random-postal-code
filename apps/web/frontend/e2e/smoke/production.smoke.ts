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
  expect((await apiResponse).status()).toBe(200);
  await expect(page.getByRole("main").getByText(/^\d{3}-\d{4}$/)).toBeVisible();
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
