import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  testMeasurementId,
  unusableMeasurementIds,
} from "./selectors/analytics-selectors.ts";

/*
 * Acceptance test for Issue #92: Measure Web visits with Google Analytics in
 * production (repository half).
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion. The browser half
 * (the tag, consent defaults, events, page views, failure isolation, and
 * /privacy) is web-google-analytics.medium.test.ts.
 *
 * What is held here, and how
 * --------------------------
 * - The design contract: docs/design.md section 7 is where optional external
 *   dependencies are named, and sections 7 and 8 together must state the
 *   consent behavior and the data Google Analytics processes. "Before the
 *   implementation lands" is an order of work, which a test on the merged
 *   tree cannot observe; this holds that the contract is there.
 * - The deploy settings check and deploy.yml, observed the way Issue #19 and
 *   #58 observe them: by reading the Pages deploy job and running the
 *   frontend verify:deploy-env with the settings the deploy would bake in.
 *   The environment name the frontend reads the ID from is the
 *   implementation choice; it is whatever deploy.yml binds to
 *   vars.ZIPNAMI_WEB_GA_MEASUREMENT_ID, in both the verify and build steps.
 * - The runbook: docs/deployment.md lists the variable in its one-time setup
 *   and the Google Analytics setup steps. GA4 counts screen changes of a
 *   single-page application through enhanced measurement page views on
 *   browser history events (Google Analytics Help, "Enhanced measurement
 *   events"); the browser half relies on it, so the setup steps must name it.
 * - The content security policy: a production build made with a measurement
 *   ID, reading the _headers Pages serves from it, must allow the hosts the
 *   tag needs. The hosts are those of Google tag platform "Use a content
 *   security policy" for Google Analytics: the loader on
 *   www.googletagmanager.com, and measurement sent to *.google-analytics.com
 *   and *.analytics.google.com. A directive the policy does not set (and no
 *   default-src) restricts nothing, so it allows them too. The existing CSP
 *   acceptance test (Issue #38) keeps running against the build without an
 *   ID on its own.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const frontend = path.join(repositoryRoot, "apps", "web", "frontend");
const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");

const MEASUREMENT_ID_VARIABLE = "ZIPNAMI_WEB_GA_MEASUREMENT_ID";
const BUILD_TIMEOUT_MS = 300_000;
// Each test that runs the verifier starts several bun processes in a row.
const SUBPROCESS_TEST_TIMEOUT_MS = 180_000;

type Step = { name?: string; run?: string; env?: Record<string, string> };
type Job = { steps?: Step[] };
type Workflow = { jobs: Record<string, Job> };

/** The single job that deploys Pages, found by what it runs. */
const pagesDeployJob = (): Job => {
  const jobs = readdirSync(workflowsDirectory)
    .filter((name) => /\.ya?ml$/.test(name))
    .map(
      (name) =>
        Bun.YAML.parse(
          readFileSync(path.join(workflowsDirectory, name), "utf8"),
        ) as Workflow,
    )
    .flatMap((workflow) => Object.values(workflow.jobs))
    .filter((job) =>
      (job.steps ?? []).some((step) =>
        /\bwrangler\b[^\n]*\bpages deploy\b/.test(step.run ?? ""),
      ),
    );

  expect(jobs).toHaveLength(1);
  return jobs[0];
};

const verifyStep = (job: Job) =>
  (job.steps ?? []).find((step) => /verify:deploy-env/.test(step.run ?? ""));

const buildStep = (job: Job) =>
  (job.steps ?? []).find(
    (step) =>
      /\bbuild\b/.test(step.run ?? "") &&
      !/verify:deploy-env/.test(step.run ?? ""),
  );

const referencesMeasurementId = (value: string | undefined) =>
  new RegExp(
    String.raw`^\$\{\{\s*(?:vars|secrets)\.` +
      MEASUREMENT_ID_VARIABLE +
      String.raw`\s*\}\}$`,
  ).test((value ?? "").trim());

/** The env names a step binds to the measurement ID variable. */
const measurementIdNamesIn = (step: Step | undefined) =>
  Object.entries(step?.env ?? {})
    .filter(([, value]) => referencesMeasurementId(value))
    .map(([name]) => name);

/** The name the Pages verify step reads the measurement ID from. */
const verifiedMeasurementIdName = (): string => {
  const names = measurementIdNamesIn(verifyStep(pagesDeployJob()));
  expect(names).toHaveLength(1);
  return names[0];
};

const run = (
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  timeout: number,
): { status: number; output: string } => {
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !/^(VITE_|ZIPNAMI_|ALLOWED_ORIGINS$|CLOUDFLARE_)/.test(key),
    ),
  );
  const result = spawnSync("bun", args, {
    cwd,
    encoding: "utf8",
    env: { ...cleanEnv, ...env },
    timeout,
  });

  // A subprocess that did not finish has refused nothing.
  if (result.status === null) {
    throw new Error(
      "bun " + args.join(" ") + " did not finish: " + String(result.error),
    );
  }

  return {
    status: result.status,
    output: result.stdout + "\n" + result.stderr,
  };
};

// Every other setting is usable, so a refusal can only be about the ID.
const usableOtherSettings = {
  VITE_API_BASE_URL: "https://zipnami-api.example-subdomain.workers.dev",
  VITE_GOOGLE_ADSENSE_CLIENT_ID: "ca-pub-1234567890123456",
  VITE_GOOGLE_ADSENSE_SLOT_ID: "9876543210",
  VITE_ADSENSE_TEST_MODE: "false",
  VITE_GOOGLE_MAPS_API_KEY: "AIzaSy0123456789abcdefghijklmnopqrstuvw",
};

const verifyFrontend = (env: Record<string, string | undefined>) =>
  run(
    ["run", "--filter", "@zipnami/web-frontend", "verify:deploy-env"],
    repositoryRoot,
    env,
    60_000,
  );

const readDoc = (...segments: string[]) =>
  readFileSync(path.join(repositoryRoot, ...segments), "utf8");

/** The text from one heading to the next, by the start of each heading. */
const sectionOf = (text: string, from: string, to: string) => {
  const start = text.indexOf(from);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = text.indexOf(to, start + from.length);
  return text.slice(start, end < 0 ? undefined : end);
};

/*
 * The production build with a measurement ID, made once for the policy tests
 * below, under the name deploy.yml passes it by. Undefined when deploy.yml
 * passes none: there is then no production build with an ID to read, and the
 * tests that need one say so.
 */
const measured = { outDir: "", buildError: "" };

beforeAll(() => {
  const name = measurementIdNamesIn(buildStep(pagesDeployJob()))[0];
  if (name === undefined) {
    measured.buildError =
      "deploy.yml passes no " + MEASUREMENT_ID_VARIABLE + " to the Pages build";
    return;
  }

  measured.outDir = mkdtempSync(path.join(tmpdir(), "zipnami-ga-release-"));
  const result = run(
    ["x", "vite", "build", "--outDir", measured.outDir, "--emptyOutDir"],
    frontend,
    {
      VITE_API_BASE_URL: "http://127.0.0.1:8787",
      [name]: testMeasurementId,
    },
    BUILD_TIMEOUT_MS,
  );
  if (result.status !== 0) {
    measured.buildError =
      "production build with a measurement ID failed:\n" + result.output;
  }
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  if (measured.outDir !== "") {
    rmSync(measured.outDir, { recursive: true, force: true });
  }
});

const measuredBuild = () => {
  expect(measured.buildError).toBe("");
  return measured.outDir;
};

/** The policy Pages serves for /, report-only or enforced, from _headers. */
const servedPolicy = (outDir: string): string => {
  let applies = false;
  const headers = new Map<string, string>();
  readFileSync(path.join(outDir, "_headers"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
    .forEach((line) => {
      if (!/^\s/.test(line)) {
        applies = line.trim() === "/*" || line.trim() === "/";
        return;
      }
      const separator = line.indexOf(":");
      if (applies && separator > 0) {
        headers.set(
          line.slice(0, separator).trim().toLowerCase(),
          line.slice(separator + 1).trim(),
        );
      }
    });

  return (
    headers.get("content-security-policy-report-only") ??
    headers.get("content-security-policy") ??
    ""
  );
};

/*
 * The sources that decide a fetch of this kind, following the CSP fallback
 * chain; undefined when no directive in the chain is set, which restricts
 * nothing. The first occurrence of a repeated directive wins, as in CSP.
 */
const sourcesFor = (
  policy: string,
  chain: readonly string[],
): string[] | undefined => {
  const directives = new Map<string, string[]>();
  policy
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .filter(([name]) => name !== undefined && name !== "")
    .forEach(([name, ...sources]) => {
      if (!directives.has(name.toLowerCase())) {
        directives.set(name.toLowerCase(), sources);
      }
    });

  return chain.map((name) => directives.get(name)).find((s) => s !== undefined);
};

const scriptChain = ["script-src-elem", "script-src", "default-src"] as const;
const connectChain = ["connect-src", "default-src"] as const;
const imageChain = ["img-src", "default-src"] as const;

/*
 * Whether a URL may be fetched under these sources, for a page on an https
 * Pages origin. Host sources with an optional leading wildcard, schemes, and
 * blanket sources; any other form fails closed, as in the Issue #38 test.
 */
const allows = (sources: string[] | undefined, url: string): boolean => {
  if (sources === undefined) return true;
  const target = new URL(url);

  return sources.some((raw) => {
    const source = raw.toLowerCase();
    if (source === "*") return true;
    if (source.startsWith("\u0027")) return false;
    if (/^[a-z][a-z0-9+.-]*:$/.test(source)) {
      return (
        source === target.protocol ||
        (source === "http:" && target.protocol === "https:")
      );
    }
    const match =
      /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.)?([a-z0-9.-]+|\*)(?::(?:\d+|\*))?(\/\S*)?$/.exec(
        source,
      );
    if (match === null) return true;
    const [, scheme, wildcard, host] = match;
    if (host === "*") return true;
    if (scheme !== undefined && scheme + ":" !== target.protocol) return false;
    return wildcard === undefined
      ? target.hostname === host
      : target.hostname.endsWith("." + host);
  });
};

const tagLoaderUrl =
  "https://www.googletagmanager.com/gtag/js?id=" + testMeasurementId;
const collectionUrls = [
  "https://www.google-analytics.com/g/collect",
  "https://region1.google-analytics.com/g/collect",
  "https://region1.analytics.google.com/g/collect",
];
const imageUrls = [
  "https://www.google-analytics.com/g/collect",
  "https://www.googletagmanager.com/a",
];

describe("Issue #92: Google Analytics is contracted, configured, and allowed for production", () => {
  test("docs/design.md names Google Analytics as an optional external dependency, with its consent behavior and the data it processes", () => {
    const design = readDoc("docs", "design.md");
    const externalServices = sectionOf(design, "## 7.", "## 8.");
    const contract = sectionOf(design, "## 7.", "## 9.");

    // Named where the optional dependencies are, alongside the isolation
    // that section requires of them.
    expect(externalServices).toMatch(/Google Analytics/);
    expect(externalServices).toMatch(/optional/i);
    // Its consent behavior: consent mode, denied in the consent regions and
    // granted elsewhere.
    expect(contract).toMatch(/consent mode/i);
    expect(contract).toMatch(/EEA|European Economic Area/);
    expect(contract).toMatch(/\bUK\b|United Kingdom/);
    expect(contract).toMatch(/Switzerland/);
    expect(contract).toMatch(/denied/i);
    expect(contract).toMatch(/granted/i);
    // The data it processes: page views, referrers, region, device.
    expect(contract).toMatch(/page views?/i);
    expect(contract).toMatch(/referr/i);
    expect(contract).toMatch(/region/i);
    expect(contract).toMatch(/device/i);
  });

  test("deploy.yml passes ZIPNAMI_WEB_GA_MEASUREMENT_ID to the frontend build, the same value the deploy settings check verifies before it", () => {
    const job = pagesDeployJob();
    const steps = job.steps ?? [];
    const verify = verifyStep(job);
    const build = buildStep(job);

    expect(verify).toBeDefined();
    expect(build).toBeDefined();
    expect(steps.indexOf(verify as Step)).toBeLessThan(
      steps.indexOf(build as Step),
    );

    const verifiedNames = measurementIdNamesIn(verify);
    const builtNames = measurementIdNamesIn(build);
    expect(builtNames).toHaveLength(1);
    // The very value the build bakes in is the one verified.
    expect(verifiedNames).toEqual(builtNames);
  });

  test(
    "the deploy settings check refuses a production deploy without a measurement ID in the G- format",
    () => {
      const name = verifiedMeasurementIdName();

      const accepted = unusableMeasurementIds.map((unusable) => ({
        unusable,
        refused:
          verifyFrontend({ ...usableOtherSettings, [name]: unusable })
            .status !== 0,
      }));
      expect(accepted).toEqual(
        unusableMeasurementIds.map((unusable) => ({ unusable, refused: true })),
      );

      // Named, so the maintainer knows which setting to fix.
      const missing = verifyFrontend({ ...usableOtherSettings });
      expect(missing.status).not.toBe(0);
      expect(
        missing.output.includes(name) ||
          missing.output.includes(MEASUREMENT_ID_VARIABLE),
      ).toBe(true);
    },
    SUBPROCESS_TEST_TIMEOUT_MS,
  );

  test(
    "the deploy settings check accepts a measurement ID in the G- format",
    () => {
      const name = verifiedMeasurementIdName();
      const result = verifyFrontend({
        ...usableOtherSettings,
        [name]: testMeasurementId,
      });

      expect(result.status).toBe(0);
    },
    SUBPROCESS_TEST_TIMEOUT_MS,
  );

  test("docs/deployment.md lists ZIPNAMI_WEB_GA_MEASUREMENT_ID and the Google Analytics setup steps", () => {
    const runbook = readDoc("docs", "deployment.md");
    const setup = sectionOf(runbook, "## One-time setup", "## Deploying");

    expect(setup).toContain(MEASUREMENT_ID_VARIABLE);
    expect(setup).toMatch(/Google Analytics/);
    // A GA4 property with a web data stream, whose ID is the G- one.
    expect(setup).toMatch(/data stream/i);
    expect(setup).toMatch(/\bG-/);
    // Screen changes are counted only with page views on browser history
    // events, an enhanced measurement setting of the stream.
    expect(setup).toMatch(/enhanced measurement/i);
    expect(setup).toMatch(/browser history/i);
  });

  test("a production build with a measurement ID depends on the Google tag loader", () => {
    const outDir = measuredBuild();
    const shipped = [
      readFileSync(path.join(outDir, "index.html"), "utf8"),
      ...readdirSync(path.join(outDir, "assets"))
        .filter((name) => name.endsWith(".js"))
        .map((name) => readFileSync(path.join(outDir, "assets", name), "utf8")),
    ].join("\n");

    // Otherwise the policy checks below would be about a host nothing uses.
    expect(shipped).toContain("googletagmanager.com/gtag/js");
  });

  test("the content security policy allows the hosts the Analytics tag needs", () => {
    const policy = servedPolicy(measuredBuild());
    expect(policy).not.toBe("");

    expect(allows(sourcesFor(policy, scriptChain), tagLoaderUrl)).toBe(true);
    expect(
      collectionUrls.filter(
        (url) => !allows(sourcesFor(policy, connectChain), url),
      ),
    ).toEqual([]);
    expect(
      imageUrls.filter((url) => !allows(sourcesFor(policy, imageChain), url)),
    ).toEqual([]);

    // Allowed by host, not by a blanket source that would allow any script.
    expect(
      allows(
        sourcesFor(policy, scriptChain),
        "https://scripts.example.invalid/x.js",
      ),
    ).toBe(false);
  });
});
