import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import type { PostalCode } from "@zipnami/shared";
import { afterAll, describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #88: Serve the full Japan Post dataset from the
 * Worker.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What "the full dataset" is held to
 * ----------------------------------
 * The exact number of postal codes changes with every monthly Japan Post
 * release, so it is not pinned. 100,000 is far above anything hand-built and
 * well below the 120,721 the 2026-10-31 retrieval produced. All 47 prefectures
 * must appear, so a partial download that happened to be large still fails.
 *
 * The bundle size limit
 * ---------------------
 * The Workers Free plan accepts a Worker of at most 3 MiB after compression.
 * The bundle is built the way `bun run build` in apps/web/backend builds it
 * (`wrangler deploy --dry-run`), into a temporary directory, and its files
 * are gzip-compressed here. Cloudflare's own compression may differ slightly;
 * gzip at the default level is the measure the Issue names.
 *
 * The criteria about the first request and about a corrupt collection are
 * held by full-postal-dataset-runtime.medium.test.ts, which runs inside the
 * Workers runtime.
 *
 * The Issue's Out of scope section (automating the monthly update, a denser
 * encoding, and #82's map-selection test) is not exercised here.
 */

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const backendRoot = path.join(repositoryRoot, "apps", "web", "backend");
const artifactPath = path.join(
  backendRoot,
  "src",
  "data",
  "postal-codes.generated.json",
);
const postalDataReadme = path.join(
  repositoryRoot,
  "packages",
  "postal-data",
  "README.md",
);

const FREE_PLAN_COMPRESSED_LIMIT_BYTES = 3 * 1024 * 1024;

// Building the Worker and regenerating the dataset each take seconds.
const COMMAND_TIMEOUT_MS = 180_000;

const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

const committedArtifact = (): PostalCode[] =>
  JSON.parse(readFileSync(artifactPath, "utf8")) as PostalCode[];

const temporaryDirectories: string[] = [];

afterAll(() => {
  for (const directory of temporaryDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("Issue #88: the full Japan Post dataset served by the Worker", () => {
  test("the committed artifact holds at least 100,000 postal codes covering all 47 prefectures", () => {
    const postalCodes = committedArtifact();

    expect(postalCodes.length).toBeGreaterThanOrEqual(100_000);

    const present = new Set(
      postalCodes.flatMap(({ addresses }) =>
        addresses.map(({ prefecture }) => prefecture),
      ),
    );

    expect(PREFECTURES.filter((name) => !present.has(name))).toEqual([]);
  });

  test("the committed artifact includes at least one postal code with more than one address", () => {
    const withSeveral = committedArtifact().filter(
      ({ addresses }) => addresses.length > 1,
    );

    expect(withSeveral.length).toBeGreaterThan(0);
  });

  test(
    "check:postal-data passes: the committed artifact is exactly what the committed source regenerates",
    () => {
      const result = spawnSync("bun", ["run", "check:postal-data"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        timeout: COMMAND_TIMEOUT_MS,
      });

      expect(result.status, result.stderr).toBe(0);
    },
    COMMAND_TIMEOUT_MS,
  );

  test(
    "the Worker bundle wrangler deploy --dry-run produces is at most 3 MiB gzip-compressed",
    () => {
      const outdir = mkdtempSync(path.join(tmpdir(), "zipnami-worker-"));
      temporaryDirectories.push(outdir);

      const result = spawnSync(
        "bunx",
        ["wrangler", "deploy", "--dry-run", `--outdir=${outdir}`],
        { cwd: backendRoot, encoding: "utf8", timeout: COMMAND_TIMEOUT_MS },
      );

      expect(result.status, result.stderr).toBe(0);

      // Source maps are not uploaded as Worker code, so they do not count
      // toward the limit.
      const uploaded = readdirSync(outdir, { recursive: true })
        .map(String)
        .filter((name) => !name.endsWith(".map"))
        .map((name) => path.join(outdir, name))
        .filter((file) => statSync(file).isFile());

      expect(uploaded.length, "the dry run wrote no bundle").toBeGreaterThan(
        0,
      );

      const compressed = uploaded.reduce(
        (total, file) => total + gzipSync(readFileSync(file)).length,
        0,
      );

      // A bundle that lost the dataset would pass the limit trivially.
      expect(compressed).toBeGreaterThan(1024 * 1024);
      expect(compressed).toBeLessThanOrEqual(FREE_PLAN_COMPRESSED_LIMIT_BYTES);
    },
    COMMAND_TIMEOUT_MS,
  );

  test("the postal-data README states the retrieval date of the committed data and that it is the full archive", () => {
    // Joined into one line, so a sentence wrapped across lines still matches.
    const readme = readFileSync(postalDataReadme, "utf8").replace(/\s+/g, " ");

    const recorded = /Retrieval date: \*\*(\d{4}-\d{2}-\d{2})\*\*/.exec(
      readme,
    )?.[1];

    expect(recorded, "no retrieval date is recorded").toBeDefined();
    expect(readme).toMatch(
      /`data\/ken-all\.source\.csv` is the full `KEN_ALL\.CSV`/,
    );
    expect(readme).not.toMatch(/has not been switched/);
    expect(readme).not.toMatch(/small hand-built source/);
  });
});
