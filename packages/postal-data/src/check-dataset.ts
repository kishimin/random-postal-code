import { buildPostalCodeDataset } from "./build-postal-code-dataset.ts";

export type PostalDataDriftCheck =
  { drifted: false } | { drifted: true; reason: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Structural equality for parsed JSON: array order matters (two datasets
 * with the same entries in a different order are not the same dataset), but
 * object key order does not (the committed artifact is hand-formatted and
 * may order keys differently from the generator without that being drift).
 */
const jsonDeepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    return (
      a.length === b.length &&
      a.every((item, index) => jsonDeepEqual(item, b[index]))
    );
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => key in b && jsonDeepEqual(a[key], b[key]))
    );
  }

  return false;
};

/**
 * Regenerates the postal-code dataset from `source` and reports whether it
 * matches `committedArtifact` (the JSON text of the committed artifact),
 * without writing anything back. Comparison is by parsed content, not by
 * byte-for-byte text, so a committed file formatted differently from the
 * generator's compact output is not treated as drift on that basis alone.
 */
export const checkPostalDataForDrift = async ({
  source,
  committedArtifact,
}: {
  source: string;
  committedArtifact: string;
}): Promise<PostalDataDriftCheck> => {
  const regenerated = await buildPostalCodeDataset(source);
  const committed = JSON.parse(committedArtifact) as unknown;

  if (jsonDeepEqual(regenerated, committed)) {
    return { drifted: false };
  }

  return {
    drifted: true,
    reason:
      "Regenerating the dataset from the committed source no longer " +
      "matches the committed artifact.",
  };
};
