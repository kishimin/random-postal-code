// Runs one package.json script in every workspace, one workspace at a time,
// prefixing each output line with `<name> <script>: ` and ending each
// workspace with `<name> <script>: Exited with code <n>`.
//
// Not `bun run --filter '*' --sequential`: that prints `<name>:<script>  |`,
// and the CI quality-gates acceptance test reads each package's coverage
// table from lines in the `bun run --filter` format (Issue #125).
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

// Only the two forms this repository's root package.json uses: a literal
// directory and `<directory>/*`.
const workspaceDirectories = (root) => {
  const { workspaces = [] } = readJson(path.join(root, "package.json"));

  return workspaces
    .flatMap((pattern) => {
      if (pattern.includes("*") && !/^[^*]+\/\*$/.test(pattern)) {
        throw new Error(`unsupported workspace pattern: ${pattern}`);
      }
      if (!pattern.endsWith("/*")) return [path.join(root, pattern)];

      const parent = path.join(root, pattern.slice(0, -2));
      if (!existsSync(parent)) return [];

      return readdirSync(parent, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(parent, entry.name))
        .sort();
    })
    .filter((directory) => existsSync(path.join(directory, "package.json")));
};

const forwardLines = (stream, prefix, target) =>
  new Promise((resolve) => {
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    lines.on("line", (line) => target.write(`${prefix}${line}\n`));
    lines.on("close", resolve);
  });

const runInWorkspace = async (directory, name, script) => {
  const prefix = `${name} ${script}: `;
  const startedAt = Date.now();
  process.stdout.write(
    `${prefix}Started at ${new Date(startedAt).toISOString()}\n`,
  );

  const child = spawn("bun", ["run", script], {
    cwd: directory,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise((resolve) => {
    child.on("error", (error) => {
      process.stderr.write(`${prefix}could not start bun: ${error.message}\n`);
      resolve(1);
    });
    child.on("close", (code, signal) => {
      if (signal !== null) {
        process.stderr.write(`${prefix}terminated by ${signal}\n`);
      }
      resolve(code ?? 1);
    });
  });

  const [code] = await Promise.all([
    exited,
    forwardLines(child.stdout, prefix, process.stdout),
    forwardLines(child.stderr, prefix, process.stderr),
  ]);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(2);
  process.stdout.write(`${prefix}Finished in ${seconds}s\n`);
  process.stdout.write(`${prefix}Exited with code ${code}\n`);

  return code;
};

const [script] = process.argv.slice(2);
if (script === undefined) {
  process.stderr.write("usage: node run-workspaces-in-turn.mjs <script>\n");
  process.exit(2);
}

// Keep going after a failure so every workspace still reports its results,
// and exit with the first failure's code.
let firstFailure = 0;
let ran = 0;
for (const directory of workspaceDirectories(process.cwd())) {
  const { name, scripts = {} } = readJson(path.join(directory, "package.json"));
  if (scripts[script] === undefined) continue;

  ran += 1;
  const code = await runInWorkspace(directory, name, script);
  if (code !== 0 && firstFailure === 0) firstFailure = code;
}

// A gate that found nothing to run has checked nothing.
if (ran === 0) {
  process.stderr.write(`no workspace has a "${script}" script\n`);
  firstFailure = 1;
}

process.exitCode = firstFailure;
