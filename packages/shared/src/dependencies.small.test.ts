import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const packageJsonPath = fileURLToPath(
  new URL("../package.json", import.meta.url),
);
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as {
  dependencies: Record<string, string>;
};

describe("package.json dependencies", () => {
  test("depends on zod only, so this package stays free of frontend and backend runtimes", () => {
    expect(Object.keys(packageJson.dependencies)).toEqual(["zod"]);
  });
});
