import { apiErrorResponseSchema } from "@zipnami/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createApp } from "../app.ts";

const app = createApp({
  postalCodeRepository: { listPostalCodes: () => Promise.resolve([]) },
});

const REPORT = JSON.stringify({
  "csp-report": {
    "document-uri": "https://zipnami.pages.dev/",
    "effective-directive": "script-src",
    "blocked-uri": "https://scripts.example.invalid/x.js",
  },
});

const post = (body: BodyInit, headers: Record<string, string>) =>
  app.request("/api/csp-report", { method: "POST", body, headers });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/csp-report", () => {
  test("answers 204 with no body", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await post(REPORT, {
      "content-type": "application/csp-report",
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  test("refuses a declared length over the limit without reading the body", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const body = new ReadableStream<Uint8Array>({
      pull: () => {
        throw new Error("the body must not be read");
      },
    });

    const response = await post(body, {
      "content-type": "application/csp-report",
      "content-length": "1000000",
    });

    expect(response.status).toBe(413);
  });

  test("refuses an undeclared body once it passes the limit", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const chunk = new TextEncoder().encode("x".repeat(4096));
    const served = { chunks: 0 };
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        served.chunks += 1;
        controller.enqueue(chunk);
      },
    });

    const response = await post(endless, {
      "content-type": "application/csp-report",
    });

    expect(response.status).toBe(413);
    expect(served.chunks).toBeLessThan(20);
  });

  test("answers 400 in the error envelope for a body that is not a report", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await post("{", {
      "content-type": "application/csp-report",
    });

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).error.code).toBe(
      "INVALID_REQUEST",
    );
  });

  test("answers 405 to a method other than POST", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request("/api/csp-report");

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  test("writes a request log entry alongside the violation", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });

    await post(REPORT, { "content-type": "application/csp-report" });

    const entries = lines.map(
      (line) => JSON.parse(line) as Record<string, unknown>,
    );
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: "/api/csp-report",
          method: "POST",
          status: 204,
          code: "OK",
        }),
        expect.objectContaining({
          type: "csp-violation",
          blockedURL: "https://scripts.example.invalid/x.js",
        }),
      ]),
    );
  });
});
