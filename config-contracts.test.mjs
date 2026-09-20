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

  return new Set(
    [...readme.matchAll(/`bun run ([a-z:]+)`/g)].map(([, name]) => name),
  );
};

const rootScripts = () =>
  new Set(Object.keys(JSON.parse(readRepositoryFile("package.json")).scripts));

test("every command the README documents exists in the workspace", () => {
  const missing = [...documentedRootCommands()].filter(
    (name) => !rootScripts().has(name),
  );

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
