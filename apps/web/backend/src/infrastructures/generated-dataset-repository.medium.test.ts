import { postalCodeSchema } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import {
  generatedDatasetRepository,
  parseGeneratedPostalCodes,
} from "./generated-dataset-repository.ts";

/*
 * api-design.md section 5: GeneratedDatasetRepository loads and validates
 * the build-time artifact. The acceptance test's own comment records why the
 * artifact is a JSON file bundled into the Worker's module graph rather than
 * a runtime request: initialization must not perform a runtime network
 * request, and the real archive Issue #34 will fetch is not retrievable yet,
 * so this reads a small placeholder artifact of real Japan Post postal
 * codes and addresses through the same contract the full dataset will use.
 */
describe("generatedDatasetRepository", () => {
  test("lists a non-empty postal code collection with every entry valid under the shared contract", async () => {
    const postalCodes = await generatedDatasetRepository.listPostalCodes();

    expect(postalCodes.length).toBeGreaterThan(0);
    expect(
      postalCodes.filter((entry) => !postalCodeSchema.safeParse(entry).success),
      "an entry in the bundled artifact failed the shared PostalCode contract",
    ).toEqual([]);
  });
});

/*
 * api-design.md section 5: a repository translates its own infrastructure
 * failures into an empty or invalid collection rather than throwing. This
 * pins that fallback directly against the parsing function, which a build
 * that ships a corrupt artifact cannot otherwise reach through the real
 * bundled JSON -- it is always valid by construction of the build step.
 */
describe("parseGeneratedPostalCodes", () => {
  test("falls back to an empty collection when the raw data is not an array of valid postal codes", () => {
    const corrupt = [{ postalCode: "not-a-postal-code", addresses: [] }];

    expect(parseGeneratedPostalCodes(corrupt)).toEqual([]);
  });
});
