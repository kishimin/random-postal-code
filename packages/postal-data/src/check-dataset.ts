import { buildPostalCodeDataset } from "./build-postal-code-dataset.ts";

export type PostalDataDriftCheck =
  | { drifted: false }
  | { drifted: true; reason: string };

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

  if (JSON.stringify(regenerated) === JSON.stringify(committed)) {
    return { drifted: false };
  }

  return {
    drifted: true,
    reason:
      "Regenerating the dataset from the committed source no longer " +
      "matches the committed artifact.",
  };
};
