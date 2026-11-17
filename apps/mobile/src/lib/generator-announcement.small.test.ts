import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { announcementOf } from "./generator-announcement";

const tokyo: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

describe("announcementOf", () => {
  test("says nothing before the first generation", () => {
    expect(announcementOf({ status: "idle" })).toBeUndefined();
  });

  test("says a postal code is being generated", () => {
    expect(announcementOf({ status: "loading", previous: tokyo })).toBe(
      "郵便番号を生成しています",
    );
  });

  test("reads out the new postal code", () => {
    expect(announcementOf({ status: "success", result: tokyo })).toBe(
      "郵便番号 100-0001 を生成しました",
    );
  });

  test("explains a failure the way the alert does", () => {
    expect(
      announcementOf({ status: "error", failure: "offline", previous: tokyo }),
    ).toBe(
      "場所を取得できませんでした。通信状態を確認して、もう一度お試しください。",
    );
  });
});
