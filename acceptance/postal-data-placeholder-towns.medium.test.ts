import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostalCodeDataset } from "@zipnami/postal-data";
import type { Address, PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #99: Stop showing Japan Post placeholder phrases
 * as town names.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What is held here, and how
 * --------------------------
 * - The rule is documented: design.md section 4.3 or the postal-data README
 *   names each placeholder phrasing and what becomes of it, and says that
 *   addresses made identical by the rule are deduplicated keeping the first.
 *   "Before the implementation" is an order of work that a test on the
 *   merged tree cannot observe; this holds that the contract is there.
 * - The committed artifact is what the Worker serves, and check:postal-data
 *   proves it is what the committed source regenerates. The criteria about
 *   the regenerated artifact are therefore read from it, with the Issue's own
 *   examples (3400000, 3060433, 9800021, 9806190, 1000301) pinned.
 * - Towns ending in 一円 are compared with the committed source CSV, so a
 *   change to any of them fails, not only to the pinned example.
 * - Deduplication after normalization is held through buildPostalCodeDataset
 *   on a small input, where two placeholder records of one postal code become
 *   the same address.
 * - The Worker bundle limit of #88 stays held by full-postal-dataset.medium.
 *   The Web display of an empty town is held by the frontend tests, which
 *   compose the address the same way for the result, history, and Maps.
 */

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const artifactPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  "backend",
  "src",
  "data",
  "postal-codes.generated.json",
);
const sourcePath = path.join(
  repositoryRoot,
  "packages",
  "postal-data",
  "data",
  "ken-all.source.csv",
);

const COMMAND_TIMEOUT_MS = 180_000;

const committedArtifact = (): PostalCode[] =>
  JSON.parse(readFileSync(artifactPath, "utf8")) as PostalCode[];

const allAddresses = (): (Address & { postalCode: string })[] =>
  committedArtifact().flatMap(({ postalCode, addresses }) =>
    addresses.map((address) => ({ postalCode, ...address })),
  );

const addressesOf = (postalCode: string): Address[] =>
  committedArtifact().find((entry) => entry.postalCode === postalCode)
    ?.addresses ?? [];

const readDoc = (...segments: string[]) =>
  readFileSync(path.join(repositoryRoot, ...segments), "utf8");

// The first few offenders name the problem; listing all of a dataset's
// worth would bury the failure message.
const firstFew = (addresses: (Address & { postalCode: string })[]) =>
  addresses.slice(0, 5).map(({ postalCode, town }) => postalCode + " " + town);

// A KEN_ALL.CSV record with only the columns the build reads filled in.
const record = (postalCode: string, city: string, town: string) =>
  `13101,"100  ","${postalCode}","ﾄｳｷｮｳﾄ","ﾁﾖﾀﾞｸ","ｶﾅ","東京都","${city}","${town}",0,0,0,0,0,0`;

describe("Issue #99: placeholder phrases are not served as town names", () => {
  test("design.md section 4.3 or the postal-data README documents the placeholder rule", () => {
    const design = readDoc("docs", "design.md");
    const readme = readDoc("packages", "postal-data", "README.md");
    const documented = (pattern: RegExp) =>
      pattern.test(design) || pattern.test(readme);

    expect(documented(/以下に掲載がない場合/)).toBe(true);
    expect(documented(/の次に番地がくる場合/)).toBe(true);
    expect(documented(/（次のビルを除く）/)).toBe(true);
    expect(documented(/（地階・階層不明）/)).toBe(true);
    expect(documented(/一円/)).toBe(true);
    // Addresses made identical by the rule: only the first is kept.
    expect(documented(/identical[^.]*first|first[^.]*identical/i)).toBe(true);
  });

  test("the regenerated artifact has no town equal to 以下に掲載がない場合 or ending in の次に番地がくる場合; those addresses have an empty town", () => {
    const placeholders = allAddresses().filter(
      ({ town }) =>
        town === "以下に掲載がない場合" ||
        town.endsWith("の次に番地がくる場合"),
    );

    expect(firstFew(placeholders)).toEqual([]);
    expect(addressesOf("3400000")).toContainEqual({
      prefecture: "埼玉県",
      city: "草加市",
      town: "",
    });
    expect(addressesOf("3060433")).toContainEqual({
      prefecture: "茨城県",
      city: "猿島郡境町",
      town: "",
    });
  });

  test("no town contains （次のビルを除く） or （地階・階層不明）, and the name before the parenthetical is kept", () => {
    const remaining = allAddresses().filter(
      ({ town }) =>
        town.includes("（次のビルを除く）") ||
        town.includes("（地階・階層不明）"),
    );

    expect(firstFew(remaining)).toEqual([]);
    expect(addressesOf("9800021")).toContainEqual({
      prefecture: "宮城県",
      city: "仙台市青葉区",
      town: "中央",
    });
    expect(addressesOf("9806190")).toContainEqual({
      prefecture: "宮城県",
      city: "仙台市青葉区",
      town: "中央アエル",
    });
  });

  test("towns ending in 一円 are unchanged", () => {
    const fromSource = readFileSync(sourcePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.split(","))
      .filter((fields) =>
        (fields[8] ?? "").replaceAll('"', "").endsWith("一円"),
      )
      .map(
        (fields) =>
          fields[2].replaceAll('"', "") + " " + fields[8].replaceAll('"', ""),
      );
    const inArtifact = allAddresses()
      .filter(({ town }) => town.endsWith("一円"))
      .map(({ postalCode, town }) => postalCode + " " + town);

    expect(fromSource.length).toBeGreaterThan(0);
    expect([...new Set(inArtifact)].sort()).toEqual(
      [...new Set(fromSource)].sort(),
    );
    expect(addressesOf("1000301")).toContainEqual({
      prefecture: "東京都",
      city: "利島村",
      town: "利島村一円",
    });
  });

  test("addresses made identical by the rule are deduplicated, keeping the first, in design.md section 4.2 order", async () => {
    const dataset = await buildPostalCodeDataset(
      [
        record("1000000", "千代田区", "以下に掲載がない場合"),
        record("1000000", "千代田区", "千代田区の次に番地がくる場合"),
        record("1000000", "千代田区", "丸の内"),
        record("1000000", "千代田区", "丸の内（次のビルを除く）"),
      ].join("\n"),
    );

    expect(dataset).toEqual([
      {
        postalCode: "1000000",
        addresses: [
          { prefecture: "東京都", city: "千代田区", town: "" },
          { prefecture: "東京都", city: "千代田区", town: "丸の内" },
        ],
      },
    ]);
  });

  test(
    "check:postal-data passes against the regenerated artifact",
    () => {
      const result = spawnSync("bun", ["run", "check:postal-data"], {
        cwd: repositoryRoot,
        encoding: "utf8",
        timeout: COMMAND_TIMEOUT_MS,
      });

      expect(result.status, result.stdout + result.stderr).toBe(0);
    },
    COMMAND_TIMEOUT_MS,
  );
});
