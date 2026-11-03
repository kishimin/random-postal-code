import {
  apiErrorResponseSchema,
  postalCodeSchema,
  type PostalCode,
} from "@zipnami/shared";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createApp } from "../apps/web/backend/src/app.ts";
import worker from "../apps/web/backend/src/index.ts";

/*
 * Acceptance test for Issue #88: Serve the full Japan Post dataset from the
 * Worker. The runtime half; full-postal-dataset.medium.test.ts holds the
 * criteria about the committed files and the bundle.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * Why the first request is what is held
 * -------------------------------------
 * The Workers Free plan limits each request to 10 ms of CPU. Validating the
 * full dataset's 120,000 entries takes tens of milliseconds, so the work has
 * to happen once, at module evaluation, where the startup limit applies. The
 * repository already does that. What the Issue forbids is the first request
 * repeating it.
 *
 * "Validating the entries" is observed as calls to the shared PostalCode
 * schema's own parse methods. That is how every validation in the backend
 * reaches an entry today. This file runs in its own isolate, so the request
 * below is the first one the Worker serves here. The module-evaluation
 * validation has already happened by the time the spies are installed, so
 * only work done during the request is counted.
 *
 * A repository other than the bundled one (a stub here) still has to be
 * validated, so a corrupt entry keeps mapping to 503 DATA_UNAVAILABLE
 * (api-design.md section 4.2).
 */

const origin = "https://zipnami.example";

const newExecutionContext = () => ({
  waitUntil: (promise: Promise<unknown>) => void promise,
  passThroughOnException: () => {},
});

type WorkerFetchArguments = Parameters<typeof worker.fetch>;

const respond = async (request: Request): Promise<Response> =>
  await worker.fetch(
    request,
    {} as WorkerFetchArguments[1],
    newExecutionContext() as unknown as WorkerFetchArguments[2],
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Issue #88: serving the full dataset within the request CPU budget", () => {
  test("the first GET /api/random served by the deployed Worker does not validate the bundled dataset's entries again", async () => {
    const safeParse = vi.spyOn(postalCodeSchema, "safeParse");
    const parse = vi.spyOn(postalCodeSchema, "parse");

    const response = await respond(new Request(`${origin}/api/random`));

    expect(response.status, await response.clone().text()).toBe(200);
    expect(postalCodeSchema.safeParse(await response.json()).success).toBe(
      true,
    );

    // The assertion above calls safeParse once itself; nothing else may.
    expect(safeParse).toHaveBeenCalledTimes(1);
    expect(parse).not.toHaveBeenCalled();
  });

  test("a repository that returns a collection with a corrupt entry still yields 503 DATA_UNAVAILABLE", async () => {
    const valid: PostalCode = {
      postalCode: "1000001",
      addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
    };
    const corrupt = [
      valid,
      { postalCode: "not-a-postal-code", addresses: [] },
    ] as unknown as readonly PostalCode[];
    const app = createApp({
      postalCodeRepository: { listPostalCodes: async () => corrupt },
    });

    const response = await app.fetch(new Request(`${origin}/api/random`));
    const text = await response.clone().text();

    expect(response.status, text).toBe(503);

    const body = apiErrorResponseSchema.parse(JSON.parse(text));

    expect(body.error.code).toBe("DATA_UNAVAILABLE");
  });
});
