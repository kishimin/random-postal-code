import {
  createNotFoundPage,
  type NotFoundPage,
} from "../pages/not-found-page.ts";
import { test as shellTest } from "./test.ts";

type ErrorDestinationFixtures = {
  notFoundPage: NotFoundPage;
};

/*
 * Extends the shell fixture rather than editing it.
 *
 * ./test.ts is committed, and the ATDD guard locks a committed file under
 * acceptance/ so an implementation cannot quietly reshape the test it must
 * satisfy. Adding a Page Object for a new Issue is not that, but the guard
 * cannot tell the two apart, so the fixtures compose instead.
 */
export const test = shellTest.extend<ErrorDestinationFixtures>({
  notFoundPage: async ({ page }, use) => {
    await use(createNotFoundPage(page));
  },
});

export { expect } from "@playwright/test";
