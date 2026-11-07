import type { Address, PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { sharedArea } from "./shared-area";

const address = (prefecture: string, city: string, town: string): Address => ({
  prefecture,
  city,
  town,
});

// ui-design.md section 9.2, "Result screen" (owner decision on Issue #111).
describe("sharedArea", () => {
  test("joins prefecture, city, and town when every address shares all three", () => {
    // design.md section 4.2 removes identical triples before a response is
    // built, so this never reaches the screen; the rule still defines it.
    const addresses: PostalCode["addresses"] = [
      address("沖縄県", "宜野湾市", "大山"),
      address("沖縄県", "宜野湾市", "大山"),
    ];

    expect(sharedArea(addresses)).toBe("沖縄県宜野湾市大山");
  });

  test("leaves out the town when the addresses share only prefecture and city", () => {
    const addresses: PostalCode["addresses"] = [
      address("沖縄県", "宜野湾市", "大山1丁目"),
      address("沖縄県", "宜野湾市", "大山2丁目"),
      address("沖縄県", "宜野湾市", "大山3丁目"),
    ];

    expect(sharedArea(addresses)).toBe("沖縄県宜野湾市");
  });

  test("keeps only the prefecture when the cities differ", () => {
    const addresses: PostalCode["addresses"] = [
      address("北海道", "札幌市中央区", "旭ケ丘"),
      address("北海道", "札幌市南区", "旭ケ丘"),
    ];

    // The towns match, but a component after one that differs is left out.
    expect(sharedArea(addresses)).toBe("北海道");
  });

  test("is the whole address when there is only one", () => {
    expect(sharedArea([address("東京都", "千代田区", "千代田")])).toBe(
      "東京都千代田区千代田",
    );
  });

  test("is absent when not even the prefecture is shared", () => {
    const addresses: PostalCode["addresses"] = [
      address("愛知県", "弥富市", "鍋田町"),
      address("三重県", "桑名郡木曽岬町", "源緑輪中"),
    ];

    expect(sharedArea(addresses)).toBeUndefined();
  });

  test("is absent when the only shared components are empty", () => {
    expect(sharedArea([address("", "", "")])).toBeUndefined();
  });
});
