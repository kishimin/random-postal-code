import type { RequestHandler } from "msw";

/**
 * Default request handlers applied to every test and Storybook story.
 *
 * Handlers are added per feature as its acceptance criteria are implemented;
 * an unhandled request is bypassed rather than failed, so a missing handler
 * surfaces as the real network error the code under test would see.
 */
export const handlers: RequestHandler[] = [];
