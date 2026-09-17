import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { worker } from "../api/mocks/browser";

beforeAll(() => worker.start({ onUnhandledRequest: "bypass" }));

afterEach(() => {
  worker.resetHandlers();
  cleanup();
  localStorage.clear();
});

afterAll(() => worker.stop());
