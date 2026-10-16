import { spawn } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PostalCode } from "@zipnami/shared";
import { afterEach, describe, expect, test } from "vitest";
import { encodeShiftJis, zipArchive } from "./fixtures/ken-all-archive.ts";
import { normalizedPostalCodes } from "./fixtures/postal-code-dataset.ts";

/*
 * Acceptance test for Issue #34: Fetch and Shift-JIS-decode the real Japan
 * Post KEN_ALL archive for dataset regeneration.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * How the retrieval is exercised without Japan Post
 * --------------------------------------------------
 * The criterion that the step be testable without a live network call is met
 * by how this file runs it: the command under test is the package's own
 * `fetch-ken-all` script, run as a maintainer would run it, but pointed at a
 * local HTTP server through the `ZIPNAMI_KEN_ALL_URL` environment variable.
 * The server answers with a `ken_all.zip`-shaped archive built in memory
 * (./fixtures/ken-all-archive.ts) whose `KEN_ALL.CSV` is the Issue #3 excerpt
 * encoded as Shift-JIS with CRLF line endings, the way Japan Post publishes
 * it. Nothing here reaches the internet, so this runs in CI.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - That the README's retrieval date is a real one. Whether a date records
 *   an actual download from Japan Post is not observable from the repository;
 *   it is checked by whoever runs the documented procedure against the real
 *   site. What is held here is that the procedure is runnable: the documented
 *   commands exist and do what the criteria say.
 * - The default URL being reachable. Requesting the real site would make this
 *   a Large test; the test only checks that the README names the archive's
 *   location on japanpost.jp.
 * - The line endings of the decoded file. `buildPostalCodeDataset` accepts
 *   CRLF and LF alike (Issue #3), so the dataset it yields is the contract.
 *
 * The Issue's Out of scope section (runtime calls to Japan Post, the UTF-8
 * native distribution, checksum verification against an official hash, and
 * automating regeneration in CI) is not exercised here.
 */

const postalDataPackage = fileURLToPath(
  new URL("../packages/postal-data/", import.meta.url),
);

// The subprocess is awaited asynchronously so the in-process server below
// can answer it; a timeout bounds a hung command.
const COMMAND_TIMEOUT_MS = 30_000;

type CommandResult = { exitCode: number | null; stderr: string };

const runPackageScript = (
  args: readonly string[],
  env: Record<string, string> = {},
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn("bun", ["run", ...args], {
      cwd: postalDataPackage,
      env: { ...process.env, ...env },
      timeout: COMMAND_TIMEOUT_MS,
    });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode, stderr });
    });
  });

const kenAllCsv = readFileSync(
  new URL("./fixtures/japan-post-ken-all-excerpt.csv", import.meta.url),
  "utf8",
).replace(/\r?\n/g, "\r\n");

const kenAllZip = zipArchive("KEN_ALL.CSV", encodeShiftJis(kenAllCsv));

const servers: Server[] = [];
const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map(
        (server) =>
          new Promise<void>((resolve) => server.close(() => resolve())),
      ),
  );
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Starts a local server and returns the URL the command should fetch. */
const serve = async (handler: RequestListener): Promise<string> => {
  const server = createServer(handler);

  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  return `http://127.0.0.1:${port}/zipcode/dl/kogaki/zip/ken_all.zip`;
};

const serveBytes = (status: number, body: Uint8Array): Promise<string> =>
  serve((_request, response) => {
    response.writeHead(status, { "Content-Type": "application/zip" });
    response.end(body);
  });

/** A URL nothing listens on: the port of a server that was just closed. */
const unreachableUrl = async (): Promise<string> => {
  const server = createServer();

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  await new Promise<void>((resolve) => server.close(() => resolve()));

  return `http://127.0.0.1:${port}/zipcode/dl/kogaki/zip/ken_all.zip`;
};

const workDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), "zipnami-ken-all-"));

  directories.push(directory);

  return directory;
};

const fetchKenAll = (url: string, outputPath: string) =>
  runPackageScript(["fetch-ken-all", outputPath], {
    ZIPNAMI_KEN_ALL_URL: url,
  });

const byPostalCode = (dataset: readonly PostalCode[]): PostalCode[] =>
  [...dataset].sort((left, right) =>
    left.postalCode < right.postalCode ? -1 : 1,
  );

describe("Issue #34: retrieving the Japan Post KEN_ALL archive", () => {
  test("downloads ken_all.zip, extracts KEN_ALL.CSV, and decodes it from Shift-JIS to UTF-8", async () => {
    const url = await serveBytes(200, kenAllZip);
    const csvPath = path.join(workDirectory(), "ken-all.csv");

    const result = await fetchKenAll(url, csvPath);

    expect(result.exitCode, result.stderr).toBe(0);
    // Read as UTF-8: Shift-JIS bytes would come back as replacement
    // characters, and the comparison against the original text would fail.
    expect(readFileSync(csvPath, "utf8").replace(/\r\n/g, "\n")).toBe(
      kenAllCsv.replace(/\r\n/g, "\n"),
    );
  });

  test("hands the decoded text to the existing regenerate step, which builds the dataset from it", async () => {
    const url = await serveBytes(200, kenAllZip);
    const directory = workDirectory();
    const csvPath = path.join(directory, "ken-all.csv");
    const datasetPath = path.join(directory, "postal-codes.json");

    expect((await fetchKenAll(url, csvPath)).exitCode).toBe(0);

    const regenerate = await runPackageScript([
      "regenerate",
      csvPath,
      datasetPath,
    ]);

    expect(regenerate.exitCode, regenerate.stderr).toBe(0);
    // The value the Issue #4 acceptance test already holds as the normalized
    // output of this excerpt.
    expect(
      byPostalCode(
        JSON.parse(readFileSync(datasetPath, "utf8")) as PostalCode[],
      ),
    ).toEqual(byPostalCode(normalizedPostalCodes));
  });

  describe("fails loudly and writes nothing when the download is unusable", () => {
    const unusableResponses: [string, () => Promise<string>][] = [
      ["a network error", unreachableUrl],
      ["an HTTP error status", () => serveBytes(503, kenAllZip)],
      ["an empty response", () => serveBytes(200, new Uint8Array())],
      [
        "a truncated archive",
        () =>
          serveBytes(
            200,
            kenAllZip.subarray(0, Math.floor(kenAllZip.length / 2)),
          ),
      ],
      [
        "an archive without KEN_ALL.CSV",
        () =>
          serveBytes(
            200,
            zipArchive("README.TXT", encodeShiftJis("not the data\r\n")),
          ),
      ],
    ];

    test.each(unusableResponses)(
      "exits non-zero without creating the output on %s",
      async (_case, urlFor) => {
        const url = await urlFor();
        const csvPath = path.join(workDirectory(), "ken-all.csv");

        const result = await fetchKenAll(url, csvPath);

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr.trim()).not.toBe("");
        expect(existsSync(csvPath)).toBe(false);
      },
    );

    test("leaves a previous output untouched when a later download fails", async () => {
      const url = await serveBytes(200, new Uint8Array());
      const csvPath = path.join(workDirectory(), "ken-all.csv");

      writeFileSync(csvPath, "previous retrieval\n");

      const result = await fetchKenAll(url, csvPath);

      expect(result.exitCode).not.toBe(0);
      expect(readFileSync(csvPath, "utf8")).toBe("previous retrieval\n");
    });
  });

  test("documents a re-runnable procedure: the archive location and commands that exist", () => {
    const readme = readFileSync(
      path.join(postalDataPackage, "README.md"),
      "utf8",
    );
    const manifest = JSON.parse(
      readFileSync(path.join(postalDataPackage, "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };

    expect(readme).toMatch(
      /https:\/\/www\.post\.japanpost\.jp\/\S*ken_all\.zip/,
    );

    // The retrieval and the regeneration both have to be written down as
    // commands, and a documented command that does not exist is worse than
    // none. The filter form counts as the same command.
    const documented = [
      ...readme.matchAll(/bun run (?:--filter\s+\S+\s+)?([^\s`]+)/g),
    ].map(([, name]) => name);

    expect(documented).toEqual(
      expect.arrayContaining(["fetch-ken-all", "regenerate"]),
    );
    expect(
      documented.filter(
        (name) => !Object.keys(manifest.scripts ?? {}).includes(name),
      ),
    ).toEqual([]);
  });

  test("documents one procedure: regenerate reads the file fetch-ken-all writes", () => {
    const readme = readFileSync(
      path.join(postalDataPackage, "README.md"),
      "utf8",
    );

    // The README documents regenerate in several places with different
    // inputs. What has to agree is the pair written down together as the
    // retrieval procedure: the code block that runs fetch-ken-all (Issue
    // #55). A shell line continuation is joined first.
    const procedure = [...readme.matchAll(/```[a-z]*\n([\s\S]*?)```/g)]
      .map(([, block]) => block.replace(/\\\n\s*/g, " "))
      .find((block) => /\bfetch-ken-all\b/.test(block));

    expect(procedure, "no code block runs fetch-ken-all").toBeDefined();

    const written = /\bfetch-ken-all\s+--\s+(\S+)/.exec(procedure ?? "")?.[1];
    const read = /\bregenerate\s+--\s+(\S+)/.exec(procedure ?? "")?.[1];

    expect(written).toBeDefined();
    expect(read).toBe(written);
  });

  test("records the date of an actual retrieval", () => {
    const readme = readFileSync(
      path.join(postalDataPackage, "README.md"),
      "utf8",
    );

    // Issue #34's real retrieval has happened (2026-10-16), so the README
    // must carry a concrete date and no longer say it has not (Issue #55).
    // Whether the date matches a real download is not observable here.
    expect(readme).toMatch(/Retrieval date: \*\*\d{4}-\d{2}-\d{2}\*\*/);
    expect(readme).not.toMatch(/not yet retrieved/i);
  });
});
