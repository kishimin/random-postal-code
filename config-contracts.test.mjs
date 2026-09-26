import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Contracts that hold between packages and between a package and the platform
// it deploys to. They cannot live in either package's own suite: the frontend
// unit project runs in a browser and has no filesystem, and asserting the
// frontend's local port from the backend's suite would invert the dependency.
const repositoryRoot = fileURLToPath(new URL("./", import.meta.url));
const frontendRoot = path.join(repositoryRoot, "apps", "web", "frontend");
const backendRoot = path.join(repositoryRoot, "apps", "web", "backend");

const readRepositoryFile = (...segments) =>
  readFileSync(path.join(repositoryRoot, ...segments), "utf8");

const collectSourceFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return collectSourceFiles(entryPath);

    // Tests name variables they invent as fixtures, which are not variables the
    // application reads.
    if (/\.(small|medium|large)\.test\.tsx?$/.test(entry.name)) return [];

    return /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });

const declaredEnvironmentVariables = () => {
  const example = readRepositoryFile("apps", "web", "frontend", ".env.example");

  return new Set(
    example
      .split("\n")
      .map((line) => /^([A-Z0-9_]+)=/.exec(line.trim())?.[1])
      .filter((name) => name !== undefined),
  );
};

const referencedEnvironmentVariables = () => {
  const names = new Set();

  // Any mention of the name, not `import.meta.env.X` specifically: the
  // application hands the whole environment to a schema rather than reading
  // properties, so the names appear only inside that schema.
  for (const file of collectSourceFiles(path.join(frontendRoot, "src"))) {
    for (const [name] of readFileSync(file, "utf8").matchAll(
      /\bVITE_[A-Z0-9_]+\b/g,
    )) {
      names.add(name);
    }
  }

  return names;
};

const documentedValueOf = (name) => {
  const example = readRepositoryFile("apps", "web", "frontend", ".env.example");
  const value = new RegExp(`^${name}=(.*)$`, "m").exec(example)?.[1];

  assert.ok(value !== undefined, `${name} is not declared in .env.example`);

  return value.trim().replace(/^["']|["']$/g, "");
};

test(".env.example declares every variable the application reads", () => {
  assert.deepEqual(
    [...referencedEnvironmentVariables()].sort(),
    [...declaredEnvironmentVariables()].sort(),
  );
});

test("the documented API base URL is one the application would accept", () => {
  // The same rule env.schema.ts enforces: a bare host:port or a relative path
  // is rejected, so a developer who copies .env.example gets a working build
  // rather than a request to undefined/api/random.
  const { protocol } = new URL(documentedValueOf("VITE_API_BASE_URL"));

  assert.ok(
    protocol === "http:" || protocol === "https:",
    `expected an http or https URL, got ${protocol}`,
  );
});

test("the documented API base URL reaches the port wrangler dev serves", () => {
  const wrangler = readFileSync(
    path.join(backendRoot, "wrangler.jsonc"),
    "utf8",
  );
  // Scoped to the dev block so an unrelated "port" elsewhere in the config
  // cannot satisfy this by accident.
  const servedPort = /"dev"\s*:\s*\{[^}]*"port"\s*:\s*(\d+)/.exec(
    wrangler,
  )?.[1];

  assert.ok(
    servedPort !== undefined,
    "wrangler.jsonc must pin dev.port, or the documented URL has nothing to agree with",
  );
  assert.equal(
    new URL(documentedValueOf("VITE_API_BASE_URL")).port,
    servedPort,
  );
});

// Symmetric to the check above: that one keeps the backend's dev.port in
// sync with the port the frontend calls; this one keeps ALLOWED_ORIGINS in
// sync with the origin the frontend actually runs on, so the two configs
// cannot drift apart with nothing in CI to catch it (CR-001/TR-001).
test("wrangler.jsonc's default local ALLOWED_ORIGINS matches the origin Vite's dev server serves", () => {
  const wrangler = readFileSync(
    path.join(backendRoot, "wrangler.jsonc"),
    "utf8",
  );
  // Scoped to the vars block for the same reason the dev.port check above
  // is scoped to the dev block: an unrelated ALLOWED_ORIGINS-shaped string
  // elsewhere in the file must not satisfy this by accident.
  const allowedOrigins =
    /"vars"\s*:\s*\{[^}]*"ALLOWED_ORIGINS"\s*:\s*"([^"]*)"/.exec(wrangler)?.[1];

  assert.ok(
    allowedOrigins !== undefined,
    "wrangler.jsonc must set vars.ALLOWED_ORIGINS, or local development has no allowlist to authorize the frontend's own origin",
  );

  // vite.config.ts declares no server.port, so Vite serves its dev server on
  // its own documented default (5173) rather than a value this repository
  // chose and could restate in a config file. Guarded here: if vite.config.ts
  // ever does pin a port, this assertion fails so the expected origin below
  // gets updated to match instead of silently drifting from it.
  const viteConfig = readRepositoryFile(
    "apps",
    "web",
    "frontend",
    "vite.config.ts",
  );

  assert.ok(
    !/\bserver\s*:\s*\{[^}]*\bport\b/.test(viteConfig),
    "vite.config.ts now pins a dev server port; update the expected origin in this test to match it",
  );

  assert.equal(allowedOrigins, "http://localhost:5173");
});

// TR-005: vitest.config.ts's own comment records that removing one of these
// entries "breaks nothing that CI checks today" -- ADR-0067's diff guard
// only watches the acceptance/ directory, which this file sits outside of.
// This is the guard that comment says does not exist yet.
test("apps/web/backend's vitest config still runs both acceptance tests", () => {
  const vitestConfig = readRepositoryFile(
    "apps",
    "web",
    "backend",
    "vitest.config.ts",
  );

  for (const acceptanceTest of [
    "random-postal-code-api.medium.test.ts",
    "cors-and-secret-boundaries.medium.test.ts",
  ]) {
    assert.ok(
      vitestConfig.includes(acceptanceTest),
      `vitest.config.ts no longer lists acceptance/${acceptanceTest} in its include array, so that acceptance test would silently stop running`,
    );
  }
});

test("Pages serves index.html for a path no file matches", () => {
  const redirects = readRepositoryFile(
    "apps",
    "web",
    "frontend",
    "public",
    "_redirects",
  );
  const rules = redirects
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

  // Pages applies the first matching rule, so a catch-all placed after another
  // rule would leave that rule's paths unhandled by the router.
  assert.deepEqual(rules[0]?.split(/\s+/), ["/*", "/index.html", "200"]);
  assert.equal(
    rules.length,
    1,
    `expected only the SPA fallback, got ${JSON.stringify(rules)}`,
  );
});

/*
 * Runs a real build with the variable overridden.
 *
 * A variable already present in the environment outranks any .env file, which
 * is what makes an unusable value expressible from out here. The build fails
 * while resolving its config, before bundling, so each of these costs about a
 * second.
 */
const buildWith = (apiBaseUrl) =>
  spawnSync(
    "bunx vite build --outDir " +
      JSON.stringify(path.join(tmpdir(), "zipnami-build-contract")),
    {
      cwd: frontendRoot,
      shell: true,
      encoding: "utf8",
      env: { ...process.env, VITE_API_BASE_URL: apiBaseUrl },
    },
  );

test("the build refuses an API base URL the application cannot use", () => {
  const { status, stdout, stderr } = buildWith("not-a-url");

  assert.notEqual(status, 0, "the build should have failed");
  assert.match(stdout + stderr, /VITE_API_BASE_URL/);
});

test("the build refuses plain http for a host a browser would block", () => {
  // Pages serves over HTTPS, so mixed content stops every call in the browser
  // after the deploy. localhost is exempt, which is why .env.example works.
  const { status, stdout, stderr } = buildWith("http://api.example.com");

  assert.notEqual(status, 0, "the build should have failed");
  assert.match(stdout + stderr, /https/);
});

/*
 * The root README is where a contributor looks for the commands that run this
 * workspace. A table that drifts from package.json is worse than no table: it
 * names a command that fails, and the reader has no reason to doubt it.
 */
const documentedRootCommands = () => {
  const readme = readRepositoryFile("README.md");

  // Every mention, not only the ones inside backticks: the two commands a
  // contributor runs first sit in a fenced block, which an inline-code pattern
  // would step over. The name class is anything but whitespace and a backtick,
  // so a hyphen or a digit in a script name cannot make it invisible either.
  return new Set(
    [...readme.matchAll(/bun run ([^\s`]+)/g)].map(([, name]) => name),
  );
};

const rootScripts = () =>
  new Set(Object.keys(JSON.parse(readRepositoryFile("package.json")).scripts));

test("every command the README documents exists in the workspace", () => {
  const documented = documentedRootCommands();

  // An extractor that matched nothing would satisfy the assertion below while
  // checking nothing at all, and would read as though the README agreed.
  assert.ok(
    documented.size >= 6,
    `extracted ${documented.size} commands from the README; the pattern is broken`,
  );

  const missing = [...documented].filter((name) => !rootScripts().has(name));

  assert.deepEqual(missing, []);
});

test("the README documents the commands Issue #1 asks it to", () => {
  // Formatting, type checking, linting, tests, coverage and builds. Not every
  // script — the point is that a contributor can find each kind of check, not
  // that the table is exhaustive.
  const documented = documentedRootCommands();

  for (const name of [
    "format",
    "typecheck",
    "lint",
    "test",
    "test:coverage:pr",
    "build",
  ]) {
    assert.ok(documented.has(name), `README does not document bun run ${name}`);
  }
});

test("the Worker wrangler deploys is the one the test imports", () => {
  // worker.medium.test.ts reaches the entry point by relative path. Pointed at
  // a different module, wrangler would deploy something no test has run.
  const wrangler = readFileSync(
    path.join(backendRoot, "wrangler.jsonc"),
    "utf8",
  );

  assert.match(wrangler, /"main"\s*:\s*"src\/index\.ts"/);
});

/*
 * Issue #1 asks that secrets, generated builds, dependencies and
 * machine-specific files stay out of version control. Nothing held that: the
 * .gitignore is correct today, and one deleted line would publish a .env with
 * no check going red.
 */
const isIgnored = (relativePath) =>
  spawnSync("git", ["check-ignore", "-q", relativePath], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).status === 0;

test("git ignores secrets, build output, dependencies and editor state", () => {
  const shouldBeIgnored = [
    "apps/web/frontend/.env",
    "apps/web/frontend/dist/index.html",
    "apps/web/frontend/coverage/index.html",
    "node_modules/anything",
    "apps/web/backend/.wrangler/state",
    ".idea/workspace.xml",
    // TR-006: cors-middleware.ts documents `.dev.vars` as a supported
    // location for ALLOWED_ORIGINS. Without this rule, following that
    // guidance and running `git add -A` commits the local Workers secret file.
    "apps/web/backend/.dev.vars",
  ];

  assert.deepEqual(
    shouldBeIgnored.filter((candidate) => !isIgnored(candidate)),
    [],
  );
});

test("git keeps the example env file the README tells you to copy", () => {
  // The .env rule is broad enough to swallow this one, so it is exempted on
  // purpose. A rewrite that drops the exemption removes the file a new
  // contributor starts from.
  assert.equal(isIgnored("apps/web/frontend/.env.example"), false);
});

test("nothing that should be ignored is already tracked", () => {
  // check-ignore describes the rules; this describes what happened. A file
  // committed before a rule existed stays tracked and the rule never applies.
  const tracked = spawnSync("git", ["ls-files"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).stdout.split("\n");

  const escaped = tracked.filter((file) =>
    /(^|\/)(node_modules|dist|coverage|\.wrangler|\.idea)\//.test(file),
  );

  assert.deepEqual(escaped, []);
});
