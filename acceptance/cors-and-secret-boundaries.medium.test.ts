import { apiErrorResponseSchema } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import worker from "../apps/web/backend/src/index.ts";

/*
 * Acceptance test for Issue #11: Enforce the Web API CORS and secret
 * boundaries.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * Why this acceptance test has no browser
 * ---------------------------------------
 * What this Issue delivers is a rule about which browsers a separately
 * deployed API answers. The rule is enforced by response headers, and a real
 * browser would only report its consequence -- a blocked fetch with an opaque
 * console message -- while hiding which header was wrong. Driving Chrome would
 * also mean that a disallowed origin could only be observed as "the page
 * failed", which is indistinguishable from the API being down. So the
 * observable surface taken here is the one the browser itself reads: the
 * response to a request carrying an `Origin` header.
 *
 * It stays in `acceptance/` because ADR-0062 makes that directory the location
 * that identifies and protects an acceptance test, independently of how it is
 * executed. Per ADR-0069 exactly one runner claims it by name:
 * `apps/web/backend/vitest.config.ts` includes this file, and Playwright's
 * `testMatch` -- an explicit list, not a directory glob -- does not.
 *
 * It runs inside workerd through the Cloudflare Vitest pool the backend
 * package already configures. That pool reads wrangler.jsonc from disk and
 * runs the Worker in a second process, which is what makes this a medium test
 * (ADR-0004, ADR-0044); nothing here reaches a real network or a real browser.
 *
 * Where the behavior is observed, and why through the Worker entry point
 * ----------------------------------------------------------------------
 * Every request below goes through `worker.fetch(request, env, ctx)` -- the
 * Worker wrangler deploys, with the environment the deployment supplies.
 *
 * That is deliberate. Two of the criteria are about environments ("Production
 * allows...", "Development permits..."), and in Workers an environment reaches
 * the code as `env`. An acceptance test that built an application object by
 * hand and handed it an origin list would hold the policy while leaving the
 * step that actually differs between production and development -- reading the
 * deployment's configuration -- untested, and would leave "the deployed Worker
 * authorizes the Pages origin" true of something that is not deployed.
 *
 * Driving the entry point also means the requests are answered by the real
 * dataset, so the success and error responses these tests read are the ones
 * Issue #4 already fixed. No substitute repository is needed or used here.
 *
 * Where the origin configuration comes from, and why that is decided here
 * -----------------------------------------------------------------------
 * The criteria say "explicitly managed" and "configured" without naming the
 * configuration. design.md section 12 assigns the production Pages origin and
 * Worker URL to Issue #19, to be fixed from the provisioned Cloudflare
 * resources -- so the *values* are not this Issue's to choose, and no literal
 * production origin appears below as something the implementation must know.
 * Every origin in this file is supplied by the test as configuration.
 *
 * The *mechanism* has to land here, because "fail safely when required
 * configuration is absent" (api-design.md section 6) cannot be observed
 * without one. The reasoning, recorded so it is legible to whoever writes it
 * down as a decision record:
 *
 * - A Workers environment variable, read per request from `env`, is the only
 *   mechanism that is the same shape in all three places the allowlist has to
 *   live: a `vars` entry in wrangler.jsonc, a line in a local `.dev.vars`, and
 *   a `wrangler secret`. Keeping one shape means moving a value between them
 *   -- which is what "keep development and production allowlists separate"
 *   asks for -- changes no code.
 * - `ALLOWED_ORIGINS` as the name, holding a comma-separated list. A single
 *   variable rather than one per environment, because the environment
 *   selection is already made by which configuration file the deployment
 *   loads; a second selector inside the Worker would be a second thing that
 *   can disagree with the first. A string rather than a JSON array, because a
 *   `wrangler secret` can only ever be a string, and an allowlist that changes
 *   parser when it moves from a var to a secret is an allowlist with two
 *   behaviors.
 * - Nothing below depends on how the value is parsed beyond that separator, on
 *   where the deployment stores it, or on which middleware reads it.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - The status code a disallowed origin receives. "Do not receive CORS
 *   authorization" is a statement about one response header, and blocking is
 *   the browser's job; an API that answers 200 without the header and one that
 *   answers 403 both satisfy the criterion. Asserting a status here would
 *   forbid one of two correct implementations.
 * - The exact set of allowed request headers. `GET /api/random` takes no
 *   custom header, so an empty set and a narrow named set are both correct.
 *   What is held is the negative: not `*`, and not a credential header.
 * - The preflight's exact success status. 204 and 200 are both fine; what
 *   matters is that it is not an error, because an error blocks the request
 *   the browser was asking about.
 * - Whether `OPTIONS` appears in the allowed methods. api-design.md section 6
 *   permits handling it "only when required by the CORS middleware", which
 *   leaves the middleware free to advertise it or not.
 * - Where the two environments' allowlists are stored. That is deployment
 *   configuration, verified against the provisioned resources in Issue #19.
 *   Held here is the runtime consequence: only configured origins are
 *   authorized, and an absent configuration authorizes nothing.
 *
 * What this test does not cover, and why the Issue is not complete without it
 * ---------------------------------------------------------------------------
 * The criterion "Server-side secrets use Workers secret/config mechanisms and
 * are absent from frontend assets and Git history" is held here only in its
 * first half, as "an absent configuration authorizes nothing" -- the observable
 * consequence of the Worker reading its configuration from `env` rather than
 * from a literal.
 *
 * Its second half is not held, and was not converted rather than guessed at.
 * Zipnami has no server-side secret today: the Worker has no binding, no API
 * key, and no credential, and no document in this repository names one it is
 * expected to gain. A test asserting that an unknown set of strings is absent
 * from a frontend bundle and from every commit would either assert nothing or
 * invent the strings, and neither outcome can fail for a real defect. The
 * question of which server-side secrets exist is recorded on the Issue.
 *
 * The criterion "CORS and environment validation have automated tests" is met
 * by the tests below existing; asserting on the test suite itself would test
 * the tests rather than the boundary.
 *
 * The Issue's Out of scope section -- authentication and write APIs -- is not
 * exercised here.
 */

/** The API's own origin. Never an allowed browser origin; it is the server. */
const API_ORIGIN = "https://zipnami-api.example";

/*
 * Origins the test hands to the deployment as configuration.
 *
 * They are sample values, not the real ones. Issue #19 fixes the production
 * Pages origin from the provisioned Cloudflare resources, and nothing in the
 * implementation may recognize any string below.
 */
const PAGES_ORIGIN = "https://zipnami.pages.dev";
const CUSTOM_ORIGIN = "https://zipnami.example";
const VITE_DEV_ORIGIN = "http://localhost:5173";

/** The deployment environment a Worker is given, holding its origin allowlist. */
const configuredWith = (...origins: readonly string[]) => ({
  ALLOWED_ORIGINS: origins.join(","),
});

/*
 * The Worker's third argument, built fresh per request.
 *
 * A plain object rather than a name from @cloudflare/workers-types:
 * `acceptance/` belongs to no package and no tsconfig covers it, so a type
 * that only exists inside the backend's compilation would not resolve here.
 */
const newExecutionContext = () => ({
  waitUntil: (promise: Promise<unknown>) => void promise,
  passThroughOnException: () => {},
});

type WorkerFetchArguments = Parameters<typeof worker.fetch>;

/** One request against the Worker wrangler deploys, with a given environment. */
const respond = async (request: Request, env: unknown): Promise<Response> =>
  await worker.fetch(
    request,
    env as WorkerFetchArguments[1],
    newExecutionContext() as unknown as WorkerFetchArguments[2],
  );

/** A browser request. What makes it one is the `Origin` header the browser adds. */
const browserGet = (origin: string, path = "/api/random"): Request =>
  new Request(`${API_ORIGIN}${path}`, { headers: { origin } });

/** The preflight a browser sends before a cross-origin request it cannot simplify. */
const preflight = (
  origin: string,
  requestMethod: string,
  requestHeaders?: string,
): Request =>
  new Request(`${API_ORIGIN}/api/random`, {
    method: "OPTIONS",
    headers: {
      origin,
      "access-control-request-method": requestMethod,
      ...(requestHeaders === undefined
        ? {}
        : { "access-control-request-headers": requestHeaders }),
    },
  });

const authorizedOrigin = (response: Response): string | null =>
  response.headers.get("access-control-allow-origin");

/** Splits a comma-separated response header into comparable entries. */
const entriesOf = (value: string | null): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== "");

/**
 * Holds "does not receive CORS authorization".
 *
 * The header must be absent rather than hold some other value. A literal
 * `null` string authorizes every opaque origin -- a sandboxed iframe, a
 * `data:` document -- so an implementation that answered `null` would be
 * opening the boundary while looking closed, and must fail here.
 *
 * `Access-Control-Allow-Credentials` is checked with it because it is
 * meaningless without an authorized origin and dangerous beside a reflected
 * one; api-design.md section 6 states this endpoint enables no credentialed
 * CORS at all.
 */
const expectNoAuthorization = (response: Response, why: string): void => {
  expect(authorizedOrigin(response), why).toBeNull();
  expect(
    response.headers.get("access-control-allow-credentials"),
    why,
  ).toBeNull();
};

/** Reports what actually came back, so a wrong header is diagnosable. */
const corsDetail = (response: Response): string =>
  [
    `status=${response.status}`,
    `allow-origin=${authorizedOrigin(response)}`,
    `allow-methods=${response.headers.get("access-control-allow-methods")}`,
    `allow-headers=${response.headers.get("access-control-allow-headers")}`,
    `vary=${response.headers.get("vary")}`,
  ].join(" ");

describe("Issue #11: the CORS and secret boundaries of the Web API", () => {
  describe("which browser origins a deployed Worker authorizes", () => {
    test("authorizes every origin the deployment lists, and only those (AC: production allows the exact Pages origin and explicitly managed custom origins only)", async () => {
      const env = configuredWith(PAGES_ORIGIN, CUSTOM_ORIGIN);

      const pages = await respond(browserGet(PAGES_ORIGIN), env);
      const custom = await respond(browserGet(CUSTOM_ORIGIN), env);
      const unlisted = await respond(
        browserGet("https://someone-elses-site.example"),
        env,
      );

      // Each listed origin is echoed back individually -- the browser compares
      // this header to its own origin, so authorizing both at once is only
      // possible by naming one of them.
      expect(authorizedOrigin(pages), corsDetail(pages)).toBe(PAGES_ORIGIN);
      expect(authorizedOrigin(custom), corsDetail(custom)).toBe(CUSTOM_ORIGIN);
      expectNoAuthorization(
        unlisted,
        "an origin the deployment never listed was authorized",
      );

      // The endpoint still answers the browsers it does authorize. A CORS
      // layer that turned every request into an error would pass an assertion
      // that only read the allow-origin header.
      expect(pages.status, corsDetail(pages)).toBe(200);
    });

    test("compares scheme, host, and port exactly, refusing every near miss (AC: origin comparison does not use prefix or substring matching)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      const nearMisses = [
        // Scheme differs. A downgraded page is a different origin.
        "http://zipnami.pages.dev",
        // Port differs.
        "https://zipnami.pages.dev:8443",
        // The allowed origin is a prefix of this one: anyone may register it.
        "https://zipnami.pages.dev.attacker.test",
        // The allowed host is a suffix of this one.
        "https://xzipnami.pages.dev",
        // A subdomain is a different origin, whatever the parent allows.
        "https://preview.zipnami.pages.dev",
        // Not a valid origin serialization at all, but it does pass a
        // startsWith against the allowed value.
        "https://zipnami.pages.dev/",
      ];

      for (const origin of nearMisses) {
        const response = await respond(browserGet(origin), env);

        expectNoAuthorization(
          response,
          `${origin} was authorized against the allowlist entry ${PAGES_ORIGIN}`,
        );
      }
    });

    test("never authorizes with a wildcard, not even when the configuration itself holds one (AC: Access-Control-Allow-Origin is never set to *)", async () => {
      const arbitrary = "https://anyone-at-all.example";

      // A wildcard reaching the allowlist is the realistic way this criterion
      // is broken: someone pastes `*` into the deployment's configuration to
      // unblock a browser, and the API opens to every site on the internet
      // with no code change to review.
      const wildcarded = await respond(
        browserGet(arbitrary),
        configuredWith("*"),
      );

      expectNoAuthorization(
        wildcarded,
        "a `*` in the deployment configuration opened the API to every origin",
      );

      const env = configuredWith(PAGES_ORIGIN);
      const everyKind = [
        await respond(browserGet(PAGES_ORIGIN), env),
        await respond(browserGet(arbitrary), env),
        await respond(new Request(`${API_ORIGIN}/api/random`), env),
        await respond(preflight(PAGES_ORIGIN, "GET"), env),
        await respond(preflight(arbitrary, "GET"), env),
        await respond(browserGet(PAGES_ORIGIN, "/api/random?q=1000001"), env),
        await respond(browserGet(PAGES_ORIGIN, "/api/unknown"), env),
      ];

      expect(
        everyKind.filter((response) => authorizedOrigin(response) === "*")
          .length,
        "a response authorized every origin with a wildcard",
      ).toBe(0);
    });

    test("authorizes only the single development origin the configuration names (AC: development permits only the configured Vite development origin)", async () => {
      const env = configuredWith(VITE_DEV_ORIGIN);

      const configured = await respond(browserGet(VITE_DEV_ORIGIN), env);

      expect(authorizedOrigin(configured), corsDetail(configured)).toBe(
        VITE_DEV_ORIGIN,
      );

      // Every one of these runs on the same developer machine, and a rule
      // phrased as "allow local development" would admit all of them. Only the
      // one the configuration names is a permitted origin.
      const otherLocalOrigins = [
        // The preview server this repository's Playwright suite starts.
        "http://localhost:4173",
        // The Storybook this repository starts beside it.
        "http://localhost:6006",
        // The same server by address rather than by name.
        "http://127.0.0.1:5173",
        "https://localhost:5173",
      ];

      for (const origin of otherLocalOrigins) {
        const response = await respond(browserGet(origin), env);

        expectNoAuthorization(
          response,
          `${origin} was authorized although only ${VITE_DEV_ORIGIN} is configured`,
        );
      }

      // And a production allowlist does not quietly keep development open.
      const deployed = await respond(
        browserGet(VITE_DEV_ORIGIN),
        configuredWith(PAGES_ORIGIN),
      );

      expectNoAuthorization(
        deployed,
        "a development origin stayed authorized under a production allowlist",
      );
    });

    test("authorizes nothing when the deployment supplies no origin configuration (AC: CORS and environment validation have automated tests)", async () => {
      /*
       * api-design.md section 6: "fail startup or request handling safely when
       * required configuration is absent". Safely means the boundary closes,
       * not that it falls back to something convenient.
       *
       * This test passes trivially while no CORS layer exists, because a Worker
       * that authorizes nobody authorizes nobody by accident. It is here
       * anyway, and it is the one test that cannot be written any other way:
       * it is what separates a Worker that reads its allowlist from its
       * environment from one that carries the allowlist in its source, and the
       * latter passes every other test in this file.
       */
      for (const env of [{}, { ALLOWED_ORIGINS: "" }]) {
        for (const origin of [PAGES_ORIGIN, VITE_DEV_ORIGIN]) {
          expectNoAuthorization(
            await respond(browserGet(origin), env),
            `${origin} was authorized by a deployment that configured no allowlist (env=${JSON.stringify(env)})`,
          );
          expectNoAuthorization(
            await respond(preflight(origin, "GET"), env),
            `a preflight from ${origin} was authorized with no allowlist configured`,
          );
        }
      }
    });
  });

  describe("what an authorized browser may send and read", () => {
    test("answers a preflight without an error and offers no write method (AC: allowed methods are limited to GET /api/random requirements)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      const asked = await respond(preflight(PAGES_ORIGIN, "GET"), env);

      // An error status here blocks the GET the browser was asking about, so
      // the endpoint would be unreachable from every allowed page. The exact
      // success status is not pinned; 204 and 200 both work.
      expect(asked.status, corsDetail(asked)).toBeLessThan(400);
      expect(authorizedOrigin(asked), corsDetail(asked)).toBe(PAGES_ORIGIN);

      const offered = entriesOf(
        asked.headers.get("access-control-allow-methods"),
      );

      expect(offered, corsDetail(asked)).toContain("get");
      // This endpoint reads. A framework default that advertises the usual
      // six methods tells every allowed page that it may write here.
      expect(
        offered.filter((method) =>
          ["post", "put", "patch", "delete"].includes(method),
        ),
        "a write method was advertised to the browser",
      ).toEqual([]);
      expect(offered, corsDetail(asked)).not.toContain("*");

      // And asking for one does not get it granted.
      const writing = await respond(preflight(PAGES_ORIGIN, "POST"), env);

      expect(
        entriesOf(writing.headers.get("access-control-allow-methods")),
        corsDetail(writing),
      ).not.toContain("post");
    });

    test("opens no request header beyond what GET /api/random needs (AC: allowed request headers are limited to GET /api/random requirements)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      // `GET /api/random` takes no custom request header, so a preflight
      // asking for one is asking for something the endpoint does not have.
      // Reflecting whatever was asked -- which is what a CORS middleware does
      // when nobody configures the header list -- turns this into an endpoint
      // that accepts any header a page cares to invent, including the ones a
      // later authenticated API would use.
      const asked = await respond(
        preflight(PAGES_ORIGIN, "GET", "authorization, x-api-key, x-zipnami"),
        env,
      );

      const opened = entriesOf(
        asked.headers.get("access-control-allow-headers"),
      );

      expect(opened, corsDetail(asked)).not.toContain("*");
      expect(opened, corsDetail(asked)).not.toContain("authorization");
      expect(opened, corsDetail(asked)).not.toContain("x-api-key");
      expect(opened, corsDetail(asked)).not.toContain("x-zipnami");
    });

    test("enables no credentialed CORS on a public read-only endpoint (api-design.md section 6)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      const succeeded = await respond(browserGet(PAGES_ORIGIN), env);
      const asked = await respond(preflight(PAGES_ORIGIN, "GET"), env);

      // The endpoint has no cookie and no credential. Advertising credentialed
      // CORS beside an echoed origin is how a boundary that looks narrow
      // becomes one that sends a visitor's cookies somewhere.
      for (const response of [succeeded, asked]) {
        expect(
          response.headers.get("access-control-allow-credentials"),
          corsDetail(response),
        ).toBeNull();
      }
    });

    test("lets an authorized origin read the documented error envelope too (AC: production allows the exact Pages origin)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      // An error a browser cannot read is an error the client reports as a
      // network failure. Issue #10's screens distinguish an unavailable
      // dataset from a broken request, and they can only do that from a
      // response body the browser let them have.
      const rejected = await respond(
        browserGet(PAGES_ORIGIN, "/api/random?postalCode=1000001"),
        env,
      );

      expect(rejected.status, corsDetail(rejected)).toBe(400);
      expect(authorizedOrigin(rejected), corsDetail(rejected)).toBe(
        PAGES_ORIGIN,
      );

      const body = apiErrorResponseSchema.safeParse(await rejected.json());

      expect(body.error?.issues ?? []).toEqual([]);

      const missing = await respond(
        browserGet(PAGES_ORIGIN, "/api/unknown"),
        env,
      );

      expect(missing.status, corsDetail(missing)).toBe(404);
      expect(authorizedOrigin(missing), corsDetail(missing)).toBe(PAGES_ORIGIN);
    });

    test("marks an origin-dependent response Vary: Origin (api-design.md section 6)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      const allowed = await respond(browserGet(PAGES_ORIGIN), env);
      const denied = await respond(
        browserGet("https://someone-elses-site.example"),
        env,
      );

      // Both responses depend on the request's origin, so both must say so.
      // Without it, a cache in front of the Worker can hand the response it
      // stored for an allowed page to a disallowed one, and the allowlist is
      // enforced everywhere except where it matters.
      for (const response of [allowed, denied]) {
        expect(
          entriesOf(response.headers.get("vary")),
          corsDetail(response),
        ).toContain("origin");
      }
    });
  });

  describe("what the authorization decision is allowed to depend on", () => {
    test("ignores client-supplied forwarding and referrer headers when deciding (AC: disallowed browser origins do not receive CORS authorization)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      // api-design.md section 6: client-supplied forwarding headers are not
      // security inputs. Every header below is one a caller sets freely, so an
      // allowlist consulting any of them can be talked past by the caller it
      // was meant to exclude.
      const spoofed = new Request(`${API_ORIGIN}/api/random`, {
        headers: {
          origin: "https://someone-elses-site.example",
          "x-forwarded-host": "zipnami.pages.dev",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "127.0.0.1",
          "x-original-url": PAGES_ORIGIN,
          referer: `${PAGES_ORIGIN}/`,
        },
      });

      expectNoAuthorization(
        await respond(spoofed, env),
        "a disallowed origin was authorized on the strength of headers it set itself",
      );
    });

    test("serves a request that carries no Origin header without authorizing anything (AC: Access-Control-Allow-Origin is never set to *)", async () => {
      const env = configuredWith(PAGES_ORIGIN);

      // Not every caller is a browser. A server, a health check, or curl sends
      // no Origin and is subject to no same-origin policy, so the API must
      // keep answering it -- Issue #4's contract does not become conditional
      // on a header a browser adds. What it must not do is answer with a
      // blanket authorization that would also reach a browser.
      const response = await respond(
        new Request(`${API_ORIGIN}/api/random`),
        env,
      );

      expect(response.status, corsDetail(response)).toBe(200);
      expectNoAuthorization(
        response,
        "a request with no Origin received a CORS authorization anyway",
      );
    });
  });
});
