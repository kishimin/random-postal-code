import {
  apiErrorResponseSchema,
  postalCodeSchema,
  type ApiErrorCode,
  type ApiErrorResponse,
  type PostalCode,
} from "@zipnami/shared";
import { describe, expect, test, vi } from "vitest";
import { createApp } from "../apps/web/backend/src/app.ts";
import worker from "../apps/web/backend/src/index.ts";
import {
  eightAddressPostalCode,
  normalizedPostalCodes,
  oneAddressPostalCode,
  unevenlySizedPostalCodes,
} from "./fixtures/postal-code-dataset.ts";

/*
 * Acceptance test for Issue #4: Serve uniformly random postal codes from the
 * Hono API.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * Why this acceptance test has no browser
 * ---------------------------------------
 * What this Issue delivers is an HTTP endpoint. Its user is a client holding a
 * request and reading a response, not a person reading a screen, so the
 * observable surface is exactly that: status, headers, and body. Driving it
 * through the Web UI instead would test Issue #7's screen and report an API
 * defect as a UI failure. The test therefore runs under Vitest, and stays in
 * `acceptance/` because ADR-0062 makes that directory the location that
 * identifies and protects an acceptance test, independently of how it is
 * executed. Per ADR-0069 exactly one runner claims it by name:
 * `apps/web/backend/vitest.config.ts` includes this file, and Playwright's
 * `testMatch` — an explicit list, not a directory glob — does not.
 *
 * It runs inside workerd rather than Node, through the Cloudflare Vitest pool
 * the backend package already configures, because a response that depends on
 * the Workers runtime must fail here instead of only in production. That pool
 * reads wrangler.jsonc from disk and runs the Worker in a second process,
 * which is what makes this a medium test; nothing here reaches a real network,
 * a real browser, or a second service.
 *
 * Where each behavior is observed
 * -------------------------------
 * The request surface and the success contract are driven through the Worker's
 * own entry point, so what they hold is the Worker that wrangler deploys,
 * serving whatever dataset it really carries. An acceptance test that only
 * ever exercised a substitute would leave "GET /api/random returns 200" true
 * of a fake and unknown of the shipped thing.
 *
 * Selection behavior and the failure mappings cannot be observed that way: no
 * client can make a deployed Worker's dataset empty, and a dataset large
 * enough to be useful is too large to reason about a distribution over. Those
 * are driven through `createApp`, the composition root that already exists for
 * this reason — its own comment states that dependencies are passed in so a
 * test can supply a substitute repository without reaching into module state.
 * That is the same kind of seam as a Playwright fixture: it stands the system
 * up, and every assertion after it is still about the HTTP response.
 *
 * Where the dataset comes from, and why that is decided here
 * ----------------------------------------------------------
 * design.md section 12 assigns "Postal artifact file format" to Issue #3, but
 * Issue #3 resolved the dataset *value* and explicitly left its serialization
 * open; api-design.md section 9 still lists the format as unresolved. This
 * Issue is where it has to land, because `GeneratedDatasetRepository` is the
 * component that must load something concrete. The reasoning, recorded here so
 * it is legible to whoever writes it down as a decision record:
 *
 * - A build-time artifact bundled into the Worker's own module graph is the
 *   only option that satisfies "initialization must not perform a runtime
 *   network request" (api-design.md section 5) by construction. KV, R2, and D1
 *   each answer a load with a request to a storage service, which is a runtime
 *   request, a per-request failure mode, and a binding this test could not
 *   provision.
 * - "Loaded once per Worker isolate and treated as immutable" is then free:
 *   module evaluation happens once per isolate, with no memoization to write
 *   and no cache-invalidation bug to have.
 * - Determinism follows for the same reason. The bytes in the bundle are the
 *   bytes `bun run --filter @zipnami/postal-data regenerate` wrote, and Issue
 *   #3 already holds that identical input produces identical output.
 * - JSON rather than a generated TypeScript module: `regenerate` already emits
 *   exactly this shape, generated data has no business being type-checked and
 *   linted as source, and `postalCodeSchema` — not the compiler — is what
 *   actually guards a corrupt artifact, as the failure tests below require.
 * - The known risk is Worker bundle size against the full Japan Post dataset.
 *   It cannot be measured yet, because the real archive is not retrievable
 *   until Issue #34. Choosing a storage binding today to avoid a limit nobody
 *   has measured would trade three proven properties for a guess. If the
 *   measurement later exceeds the limit, the first remedy is a denser encoding
 *   inside the same bundled-artifact boundary, not a runtime binding.
 *
 * No assertion below depends on any of that. The format, the path, and the
 * encoding stay free to change without touching a locked acceptance test; what
 * is held is that the deployed Worker answers with a valid payload and that a
 * dataset it cannot use becomes an error rather than a partial success.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - Which layer memoizes the dataset. api-design.md section 5 asks for one
 *   load per isolate "when practical"; counting calls to the injected port
 *   would instead dictate that the application layer caches, and would fail an
 *   implementation that correctly cached inside the infrastructure layer.
 * - Index arithmetic. Section 5 asks for deterministic boundary tests of the
 *   index mapping and a focused distribution check for obvious weighting
 *   regressions. The deterministic half belongs to the inner loop, where the
 *   selection function can be called directly; held here are the two things
 *   visible from outside — that every entry is reachable, and that address
 *   count does not change a postal code's odds.
 * - The structured log format of api-design.md section 7. Nothing in a
 *   response reveals it.
 * - CORS. api-design.md section 6 describes it and Issue #11 owns it; a
 *   response without CORS headers is correct until then.
 *
 * The Issue's Out of scope section — region filters and deterministic
 * user-selected searches — is not exercised here.
 *
 * The criterion "API tests cover success, valid shape, normalized input, and
 * failure behavior" is met by the tests below existing; asserting on the test
 * suite itself would test the tests rather than the endpoint.
 */

const origin = "https://zipnami.example";

/*
 * The Worker's third argument, built fresh per request.
 *
 * A plain object rather than a name from @cloudflare/workers-types:
 * `acceptance/` belongs to no package and no tsconfig covers it, so a type
 * that only exists inside the backend's compilation would not resolve here.
 *
 * `waitUntil` is a working function rather than a stub that throws, because
 * api-design.md section 7 asks for request logging and a logger that defers
 * work must not be turned into a failed response by the context this test
 * hands it.
 */
const newExecutionContext = () => ({
  waitUntil: (promise: Promise<unknown>) => void promise,
  passThroughOnException: () => {},
});

type WorkerFetchArguments = Parameters<typeof worker.fetch>;

/** One request against the Worker wrangler deploys, entry point included. */
const respond = async (request: Request): Promise<Response> =>
  await worker.fetch(
    request,
    {} as WorkerFetchArguments[1],
    newExecutionContext() as unknown as WorkerFetchArguments[2],
  );

const get = (path: string): Request => new Request(`${origin}${path}`);

/**
 * The data boundary as the application layer sees it.
 *
 * One method returning the normalized collection is the whole port. The states
 * api-design.md section 4.2 maps to 503 — missing, unreadable, empty, invalid
 * — are all expressible as the value it returns, so the real
 * `GeneratedDatasetRepository` translates its own infrastructure failures into
 * an empty or invalid collection, which is what section 5 asks of it. A
 * rejection is therefore not a data-availability signal: it is a failure the
 * data layer did not translate, which is what "unexpected" means.
 */
type PostalCodeRepositoryStub = {
  listPostalCodes: () => Promise<readonly PostalCode[]>;
};

/*
 * Stands the application up over a known collection.
 *
 * This call does not type-check until `createApp` accepts its dependencies.
 * That is part of Red: the factory exists today and returns a bare Hono, and
 * the argument is the contract this test asks for.
 */
const serving = (
  listPostalCodes: PostalCodeRepositoryStub["listPostalCodes"],
) => createApp({ postalCodeRepository: { listPostalCodes } });

const servingCollection = (postalCodes: readonly PostalCode[]) =>
  serving(async () => postalCodes);

type Servable = { fetch: (request: Request) => Promise<Response> | Response };

/** Reports what actually came back, so a wrong status is diagnosable. */
const responseDetail = async (response: Response): Promise<string> =>
  `${response.status} ${await response.clone().text()}`;

/**
 * Holds the whole documented failure shape of api-design.md section 4.2 at
 * once: the status, the JSON media type rather than a framework's text page,
 * the envelope the shared contract describes, a message that says something,
 * and one request id reachable from both the header and the body.
 */
const expectErrorEnvelope = async (
  response: Response,
  status: number,
  code: ApiErrorCode,
): Promise<ApiErrorResponse> => {
  const text = await response.clone().text();

  expect(response.status, text).toBe(status);
  // Asserted before parsing, so a text or HTML error page reports itself
  // rather than arriving as an unreadable JSON syntax error.
  expect(response.headers.get("content-type"), text).toBe(
    "application/json; charset=utf-8",
  );

  const body = apiErrorResponseSchema.parse(JSON.parse(text));

  expect(body.error.code).toBe(code);
  expect(body.error.message).not.toBe("");
  // An id in the header that the envelope does not repeat correlates nothing:
  // a report naming one of them could not be found from the other.
  expect(response.headers.get("x-request-id")).toBe(body.error.requestId);

  return body;
};

const drawOnce = async (app: Servable): Promise<PostalCode> => {
  const response = await app.fetch(get("/api/random"));

  expect(response.status, await responseDetail(response)).toBe(200);

  return postalCodeSchema.parse(await response.json());
};

const drawMany = async (
  app: Servable,
  count: number,
): Promise<PostalCode[]> => {
  const draws: PostalCode[] = [];

  for (let index = 0; index < count; index += 1) {
    draws.push(await drawOnce(app));
  }

  return draws;
};

const countBy = (postalCodes: readonly string[]): Map<string, number> =>
  postalCodes.reduce(
    (counts, postalCode) =>
      counts.set(postalCode, (counts.get(postalCode) ?? 0) + 1),
    new Map<string, number>(),
  );

describe("Issue #4: uniformly random postal codes from the API", () => {
  describe("a successful request to the Worker that is deployed", () => {
    test("answers GET /api/random with 200 and a payload the shared PostalCode contract accepts", async () => {
      const response = await respond(get("/api/random"));

      expect(response.status, await responseDetail(response)).toBe(200);
      // safeParse rather than parse: a payload that fails should report the
      // payload, not a thrown schema error with no context.
      const parsed = postalCodeSchema.safeParse(await response.json());
      expect(parsed.error?.issues ?? []).toEqual([]);
      expect(parsed.success).toBe(true);
    });

    test("answers a successful request with JSON, no-store caching, and a request id of its own", async () => {
      const first = await respond(get("/api/random"));
      const second = await respond(get("/api/random"));

      expect(first.headers.get("content-type")).toBe(
        "application/json; charset=utf-8",
      );
      // api-design.md section 4.1: an intermediary must not turn repeated
      // generation into one cached result.
      expect(first.headers.get("cache-control")).toBe("no-store");

      const firstId = first.headers.get("x-request-id");
      const secondId = second.headers.get("x-request-id");

      expect(firstId ?? "").not.toBe("");
      expect(secondId ?? "").not.toBe("");
      // A request id shared by two requests correlates nothing.
      expect(secondId).not.toBe(firstId);
    });

    test("answers every successful request with at least one complete address", async () => {
      const draws = await drawMany({ fetch: respond }, 25);

      expect(
        draws.filter((draw) => draw.addresses.length === 0),
        "a response carried a postal code with no address",
      ).toEqual([]);
      expect(
        draws.filter((draw) =>
          draw.addresses.some(
            (address) =>
              typeof address.prefecture !== "string" ||
              typeof address.city !== "string" ||
              typeof address.town !== "string",
          ),
        ),
        "a response carried an address missing a field",
      ).toEqual([]);
    });
  });

  describe("selection over the unique normalized postal codes", () => {
    test("returns only postal codes the collection holds, and can return every one of them", async () => {
      const app = servingCollection(normalizedPostalCodes);
      const expected = normalizedPostalCodes.map((entry) => entry.postalCode);

      // 200 draws over 5 entries. Uniform selection misses one with
      // probability around 5 x 0.8^200, which is far below any rate that could
      // make this flake; an index mapping that cannot reach the first or the
      // last entry fails it every time.
      const drawn = (await drawMany(app, 200)).map((draw) => draw.postalCode);

      expect([...new Set(drawn)].sort()).toEqual([...expected].sort());
    });

    test("returns a seven-digit postal code with its leading zeroes intact", async () => {
      const app = servingCollection(normalizedPostalCodes);

      const drawn = (await drawMany(app, 200)).map((draw) => draw.postalCode);

      expect(
        drawn.filter((postalCode) => !/^[0-9]{7}$/.test(postalCode)),
        "a postal code came back in some other form than seven digits",
      ).toEqual([]);
      // Two of the five begin with a zero, and 200 draws return both. A value
      // that made a numeric round-trip would arrive as 600000.
      expect(drawn).toContain("0600000");
      expect(drawn).toContain("0640941");
    });

    test("returns each postal code with the whole normalized address group it was given", async () => {
      const app = servingCollection(normalizedPostalCodes);

      const draws = await drawMany(app, 200);

      const wrong = draws.filter((draw) => {
        const source = normalizedPostalCodes.find(
          (entry) => entry.postalCode === draw.postalCode,
        );

        return (
          JSON.stringify(draw.addresses) !== JSON.stringify(source?.addresses)
        );
      });

      // Deep equality on the array, not on its contents: collapsing a group to
      // one representative address, or re-ordering it, both pass the shared
      // contract and are both wrong.
      expect(
        wrong,
        "a response reshaped the addresses of a postal code",
      ).toEqual([]);
    });

    test("does not draw a postal code more often because it carries more addresses", async () => {
      const app = servingCollection(unevenlySizedPostalCodes);

      const counts = countBy(
        (await drawMany(app, 1000)).map((draw) => draw.postalCode),
      );

      // Uniform selection over the two entries gives each about 500 of 1000.
      // Selection over their eight and one address rows would give the
      // one-address code about 111. A floor of 300 sits roughly twelve
      // standard deviations below the uniform expectation and far above the
      // weighted one, so it separates the two without flaking.
      expect(counts.get(oneAddressPostalCode) ?? 0).toBeGreaterThan(300);
      expect(counts.get(eightAddressPostalCode) ?? 0).toBeGreaterThan(300);
    });
  });

  describe("a dataset the endpoint cannot serve", () => {
    test("answers 503 DATA_UNAVAILABLE when the dataset holds no postal code", async () => {
      const response = await servingCollection([]).fetch(get("/api/random"));

      // api-design.md section 5: a failed initialization stays an explicit
      // unavailable state and must not become an empty success payload.
      await expectErrorEnvelope(response, 503, "DATA_UNAVAILABLE");
    });

    test("answers 503 DATA_UNAVAILABLE when the dataset holds an entry the shared contract rejects", async () => {
      // A postal code the contract rejects is reachable from a real artifact:
      // Japan Post's CSV can carry an empty postal-code column, which survives
      // the build as "". api-design.md section 3 requires the API to reject an
      // invalid artifact rather than emit a partial success, so the valid
      // entry beside it must not be served either.
      const corrupt = [
        { postalCode: "not-a-postal-code", addresses: [] },
        normalizedPostalCodes[0],
      ] as unknown as readonly PostalCode[];

      const response = await servingCollection(corrupt).fetch(
        get("/api/random"),
      );

      await expectErrorEnvelope(response, 503, "DATA_UNAVAILABLE");
    });

    test("answers 500 INTERNAL_ERROR when loading the dataset fails in a way the data layer did not translate", async () => {
      const app = serving(async () => {
        throw new Error("the data layer let this escape");
      });

      const response = await app.fetch(get("/api/random"));

      await expectErrorEnvelope(response, 500, "INTERNAL_ERROR");
    });

    test("keeps failure text, file paths, and stack traces out of error responses", async () => {
      const secret = "ZIPNAMI-ACCEPTANCE-INTERNAL-DETAIL";
      const app = serving(async () => {
        throw new Error(
          `${secret} while reading /srv/zipnami/postal-codes.json`,
        );
      });

      const response = await app.fetch(get("/api/random"));

      // The envelope is asserted first on purpose. Hono's own error page
      // happens to contain none of the strings below, so a test that only
      // looked for their absence would pass against an endpoint that has no
      // error contract at all — green before anything was written, and
      // therefore holding nothing.
      const body = await expectErrorEnvelope(response, 500, "INTERNAL_ERROR");
      const text = JSON.stringify(body);

      // Each of these has reached a client from some framework's default error
      // page; api-design.md section 4.2 forbids all of them crossing the
      // public boundary.
      expect(text).not.toContain(secret);
      expect(text).not.toContain("/srv/zipnami");
      expect(text).not.toContain(".json");
      expect(text).not.toContain(".ts");
      expect(text).not.toMatch(/\bat\s+\S+:\d+/);
      expect(text).not.toContain("stack");
    });
  });

  describe("the request surface the endpoint offers", () => {
    test("takes no postal-code or address input, rejecting a query parameter with 400 INVALID_REQUEST", async () => {
      const searches = [
        "/api/random?postalCode=1000001",
        "/api/random?prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD",
        "/api/random?q=1000001",
      ];

      for (const search of searches) {
        // Not merely "does not filter": a request that looked like a search
        // and came back 200 would read to a client as a search that worked.
        await expectErrorEnvelope(
          await respond(get(search)),
          400,
          "INVALID_REQUEST",
        );
      }
    });

    test("takes no path parameter, answering a postal code in the path with 404 NOT_FOUND", async () => {
      const response = await respond(get("/api/random/1000001"));

      await expectErrorEnvelope(response, 404, "NOT_FOUND");
    });

    test("takes no request body, answering a POST with 405 METHOD_NOT_ALLOWED", async () => {
      const response = await respond(
        new Request(`${origin}/api/random`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postalCode: "1000001" }),
        }),
      );

      await expectErrorEnvelope(response, 405, "METHOD_NOT_ALLOWED");
    });

    test("answers a route no endpoint claims with 404 NOT_FOUND in the documented envelope", async () => {
      const response = await respond(get("/api/unknown"));

      // Hono's own 404 is the plain text "404 Not Found". api-design.md
      // section 4.2 requires every JSON error to use one envelope, so a
      // framework default must not cross the public boundary.
      await expectErrorEnvelope(response, 404, "NOT_FOUND");
    });

    test("makes no request to Japan Post or another address API while answering", async () => {
      // This holds request handling. It cannot also hold module evaluation,
      // which happened when this file imported the Worker, before any stub
      // could be installed — but an artifact bundled into the module graph has
      // nothing to request there, which is one of the reasons the header above
      // gives for bundling it. A load that did reach the network would have to
      // do it per request or on first use, and both land inside this stub.
      const outbound: string[] = [];

      vi.stubGlobal("fetch", (input: unknown) => {
        outbound.push(String(input));

        throw new Error("the endpoint must not reach an address service");
      });

      try {
        const responses = await Promise.all(
          Array.from(
            { length: 5 },
            async () => await respond(get("/api/random")),
          ),
        );

        // The requests must still succeed. An endpoint that answered 503
        // because its outbound call was blocked would pass an assertion that
        // only counted requests.
        expect(responses.map((response) => response.status)).toEqual([
          200, 200, 200, 200, 200,
        ]);
        expect(outbound).toEqual([]);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
