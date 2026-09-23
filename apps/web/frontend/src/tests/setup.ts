import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { worker } from "../api/mocks/browser";

/*
 * Testing Library's default 1000ms async timeout (`findBy*`, `waitFor`) was
 * tuned for jsdom, where a "render" is a synchronous, in-process function
 * call. This project's "unit" project instead runs every test in a real
 * Chromium instance (vite.config.ts's `browser.enabled`), so each awaited
 * interaction is a round trip through the browser's own event loop and, for
 * generator-experience.medium.test.tsx, through MSW's Service Worker too.
 * That is comfortably inside Vitest's own 15s browser-mode test timeout, but
 * a CI runner under load -- particularly the Coverage job, which adds v8
 * instrumentation on top of the same browser round trips -- has occasionally
 * pushed a single interaction past 1000ms and failed an assertion that
 * would otherwise have passed a moment later. Raising this default (rather
 * than annotating one call site) covers every `findBy*`/`waitFor` in this
 * project the same way, without touching what any of them assert.
 */
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => worker.start({ onUnhandledRequest: "bypass" }));

afterEach(() => {
  worker.resetHandlers();
  cleanup();
  localStorage.clear();
});

afterAll(() => worker.stop());
