import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { generatedDatasetRepository } from "../infrastructures/generated-dataset-repository.ts";

/*
 * Issue #121: the five guide pages cite entries of the bundled dataset as
 * examples and state its size (ui-design.md section 5.5, "Content rules").
 * The copy lives in the frontend workspace
 * (apps/web/frontend/src/features/guides), which cannot load this 13 MB
 * dataset in its browser test runner, so the dataset side of each claim is
 * held here and the copy side there. Both state the same literals; if a
 * dataset update makes one untrue, this test fails and the copy is what gets
 * fixed.
 *
 * An address is read as Zipnami shows it: prefecture, city, and town joined
 * (AddressList).
 */
const shownAs = (postalCode: PostalCode): string[] =>
  postalCode.addresses.map(
    ({ prefecture, city, town }) => `${prefecture}${city}${town}`,
  );

const postalCodes = await generatedDatasetRepository.listPostalCodes();

describe("the dataset facts the guide pages state", () => {
  const addressesOf = (code: string): string[] => {
    const entry = postalCodes.find(({ postalCode }) => postalCode === code);

    if (!entry) {
      throw new Error(`The dataset has no postal code ${code}.`);
    }

    return shownAs(entry);
  };

  test.each([
    ["1000001", ["東京都千代田区千代田"]],
    ["1030028", ["東京都中央区八重洲（１丁目）"]],
    ["1040028", ["東京都中央区八重洲（２丁目）"]],
    ["1006001", ["東京都千代田区霞が関霞が関ビル（１階）"]],
    ["1006002", ["東京都千代田区霞が関霞が関ビル（２階）"]],
    // The 地階・階層不明 note is dropped from the town, as the guide says.
    ["1006090", ["東京都千代田区霞が関霞が関ビル"]],
    // One code over a prefecture border: exactly these two, in no other place.
    ["4980000", ["愛知県弥富市", "三重県桑名郡木曽岬町"]],
    // 以下に掲載がない場合 is shown as the city alone.
    ["3400000", ["埼玉県草加市"]],
  ])("%s is shown as %j", (code, expected) => {
    expect(addressesOf(code)).toEqual(expected);
  });

  test("holds 120,721 postal codes", () => {
    expect(postalCodes).toHaveLength(120_721);
  });

  test("holds 124,526 addresses in all", () => {
    const addressCount = postalCodes.reduce(
      (total, { addresses }) => total + addresses.length,
      0,
    );

    expect(addressCount).toBe(124_526);
  });

  test("has 1,338 postal codes with more than one address", () => {
    expect(
      postalCodes.filter(({ addresses }) => addresses.length > 1),
    ).toHaveLength(1_338);
  });
});
