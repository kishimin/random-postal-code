import { describe, expect, test } from "vitest";
import worker from "./index";

/*
 * Holds that the Worker runs, which is Issue #1's criterion rather than any
 * product behavior.
 *
 * The test executes inside workerd, not Node, so importing the entry point
 * here fails if the runtime refuses to start or if the module uses something
 * the platform does not provide. The pool builds the `main` wrangler.jsonc
 * names before any test runs, so a broken path there fails this too — checked
 * by pointing `main` at a file that does not exist and watching it go red.
 *
 * Reached through the default export rather than `exports` from
 * cloudflare:workers, whose type comes from the generated
 * worker-configuration.d.ts that this repository does not track.
 *
 * The path is one no route will claim. Asserting a 404 asserts that a response
 * came back at all, not that Hono routes correctly — routing arrives with
 * Issue #4 and the acceptance tests that define it.
 */
describe("the Worker in the local Workers runtime", () => {
  test("answers a request through its fetch handler", async () => {
    const response = await worker.fetch(
      new Request("https://zipnami.example/a-path-no-route-claims"),
      {},
      // Hono stores this and does not reach for it while answering a path no
      // route matches. That holds only until a wildcard middleware lands:
      // `app.use("*", ...)` runs on unmatched paths too, and a logger calling
      // waitUntil would throw here and surface as `expected 500 to be 404`.
      // Issues #4 and #11 bring the request logging api-design.md section 7
      // asks for; replace this with a real context then.
      {} as ExecutionContext,
    );

    expect(response.status).toBe(404);
  });
});
