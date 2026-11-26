import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

/*
 * Issue #170: the guides /guide/history, /guide/address and
 * /guide/municipality-code quote columns of Japan Post's KEN_ALL rows that
 * Zipnami's generated dataset drops: the local government code, the old
 * postal code and the 小字 flag. This test holds those quotes against the
 * committed source file, so a data update that makes one untrue fails here
 * and the copy is what gets fixed (ui-design.md section 5.5, "Content
 * rules"). The copy lives in apps/web/frontend/src/features/guides.
 *
 * Columns, from Japan Post's readme: 1 全国地方公共団体コード, 2 旧郵便番号,
 * 3 郵便番号, 7 都道府県名, 11 小字毎に番地が起番されている町域の表示.
 */
type Row = {
  readonly localGovernmentCode: string;
  readonly oldPostalCode: string;
  readonly postalCode: string;
  readonly prefecture: string;
  /*
   * The four town flags, in the readme's order: one town over several codes,
   * lot numbers per 小字, has 丁目, one code over several towns.
   */
  readonly townFlags: readonly string[];
  readonly numberedPerKoaza: boolean;
};

const unquote = (field: string) => field.replace(/^"|"$/g, "");

const rows: readonly Row[] = readFileSync(
  new URL("./ken-all.source.csv", import.meta.url),
  "utf8",
)
  .split(/\r?\n/)
  .filter((line) => line !== "")
  .map((line) => line.split(",").map(unquote))
  .map((fields) => ({
    localGovernmentCode: fields[0],
    oldPostalCode: fields[1].trim(),
    postalCode: fields[2],
    prefecture: fields[6],
    townFlags: fields.slice(9, 13),
    numberedPerKoaza: fields[10] === "1",
  }));

const rowsOf = (postalCode: string) => {
  const found = rows.filter((row) => row.postalCode === postalCode);

  if (found.length === 0) {
    throw new Error(`The source has no row for ${postalCode}.`);
  }

  return found;
};

describe("the KEN_ALL columns the guides quote", () => {
  test.each([
    ["1000001", ["13101"]],
    ["1000013", ["13101"]],
    ["0600906", ["01103"]],
    // One code over two municipalities: one row, and one code, for each.
    ["4980000", ["23235", "24303"]],
  ])("%s is recorded under the local government code %j", (code, expected) => {
    expect(rowsOf(code).map((row) => row.localGovernmentCode)).toEqual(
      expected,
    );
  });

  test.each([
    ["1540023", "154"],
    ["3501106", "35011"],
  ])("%s keeps the old postal code %s", (code, oldCode) => {
    expect(rowsOf(code).map((row) => row.oldPostalCode)).toEqual([oldCode]);
  });

  test("藤崎 (0383802) is a town whose lot numbers start again in each 小字", () => {
    expect(rowsOf("0383802").map((row) => row.numberedPerKoaza)).toEqual([
      true,
    ]);
  });

  test.each([
    // 八重洲（１丁目）: split over several codes, and has 丁目.
    ["1030028", ["1", "0", "1", "0"]],
    // 千代田: none of the four.
    ["1000001", ["0", "0", "0", "0"]],
  ])("%s carries the town flags %j", (code, flags) => {
    expect(rowsOf(code).map((row) => row.townFlags)).toEqual([flags]);
  });

  test.each([
    ["東京都", "13"],
    ["北海道", "01"],
  ])(
    "every %s row's local government code starts with %s",
    (prefecture, prefix) => {
      const ofPrefecture = rows.filter((row) => row.prefecture === prefecture);

      expect(ofPrefecture.length).toBeGreaterThan(0);
      expect(
        ofPrefecture.filter(
          (row) => !row.localGovernmentCode.startsWith(prefix),
        ),
      ).toEqual([]);
    },
  );
});
