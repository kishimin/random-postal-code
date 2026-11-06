import type { Page, Request } from "@playwright/test";

/*
 * Page Object for the Issue #104 probe: a document of the test's own, answered
 * at the route, whose markup asks for each third-party host the production
 * tests must never reach.
 *
 * It is served from a host that does not exist, so nothing but the route can
 * answer it, and the only requests that can leave the browser are the ones
 * the markup makes.
 */

const probeOrigin = "https://zipnami-production-probe.example.com";

/** A request the probe document makes while it loads. */
export type ProbeRequest = {
  /** What the host is, for a readable failure. */
  readonly host: string;
  readonly url: string;
  /** How the document asks for it: a script loads, an image beacons. */
  readonly tag: "script" | "img";
};

/** What became of one probe request. */
export type ProbeOutcome = {
  readonly host: string;
  readonly sent: boolean;
  readonly failed: boolean;
  readonly answered: boolean;
};

const probeDocument = (requests: readonly ProbeRequest[]) => `<!doctype html>
<html lang="en">
  <head>
    <title>Production probe</title>
    ${requests
      .map(({ url, tag }) =>
        tag === "script"
          ? `<script async src="${url}"></script>`
          : `<img alt="" src="${url}">`,
      )
      .join("\n    ")}
  </head>
  <body></body>
</html>`;

/**
 * Creates the probe Page Object.
 * @param page - The Playwright page, as the production fixture prepared it.
 */
export const createProductionProbePage = (page: Page) => {
  const sent = new Set<string>();
  const failed = new Set<string>();
  const answered = new Set<string>();
  let requests: readonly ProbeRequest[] = [];

  const remember = (into: Set<string>) => (request: Request) => {
    into.add(request.url());
  };

  /**
   * Loads the probe document. Every request in its markup is made while the
   * document is still loading, so only blocking installed before this call
   * can stop it.
   * @param probeRequests - The requests the document makes.
   */
  const navigate = async (probeRequests: readonly ProbeRequest[]) => {
    requests = probeRequests;
    page.on("request", remember(sent));
    page.on("requestfailed", remember(failed));
    page.on("response", (response) => answered.add(response.url()));

    await page.route(`${probeOrigin}/**`, (route) =>
      route.fulfill({
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: probeDocument(probeRequests),
      }),
    );
    await page.goto(`${probeOrigin}/`);
  };

  const outcomes = (): ProbeOutcome[] =>
    requests.map(({ host, url }) => ({
      host,
      sent: sent.has(url),
      failed: failed.has(url),
      answered: answered.has(url),
    }));

  return { navigate, outcomes };
};

export type ProductionProbePage = ReturnType<typeof createProductionProbePage>;
