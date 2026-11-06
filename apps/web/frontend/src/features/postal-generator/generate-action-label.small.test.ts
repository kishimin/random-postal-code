import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { generateActionLabel } from "./generate-action-label";
import type { GeneratorState } from "./hooks/generator-state";

const result: PostalCode = {
  postalCode: "9012223",
  addresses: [{ prefecture: "沖縄県", city: "宜野湾市", town: "大山1丁目" }],
};

const failure: GeneratorState = {
  status: "error",
  error: { kind: "offline" },
};

// Figma labels the one generate action by state (Issue #97): #2:13 before a
// result, #2:33 after one, and #27:78 while the API error shows.
describe("generateActionLabel", () => {
  test.each<[string, GeneratorState]>([
    ["nothing has been generated", { status: "idle" }],
    ["the first request is in flight", { status: "loading" }],
  ])("invites the first generation when %s", (_situation, state) => {
    expect(generateActionLabel(state)).toBe("ランダム生成する");
  });

  test.each<[string, GeneratorState]>([
    ["a result is shown", { status: "success", result }],
    [
      "another request is in flight behind a result",
      { status: "loading", previousResult: result },
    ],
  ])("invites another wave when %s", (_situation, state) => {
    expect(generateActionLabel(state)).toBe("もう一度、波に乗る");
  });

  test.each<[string, GeneratorState]>([
    ["a request failed from the start screen", failure],
    [
      "a request failed behind an earlier result",
      { ...failure, previousResult: result },
    ],
  ])("offers a retry when %s", (_situation, state) => {
    expect(generateActionLabel(state)).toBe("再試行する");
  });
});
