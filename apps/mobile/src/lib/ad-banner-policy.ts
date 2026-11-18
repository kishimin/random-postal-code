/**
 * Picks the unit a banner requests ads with.
 *
 * Only a release build may use a production unit. A development build or an
 * automated run that requested ads with one would count impressions and
 * clicks on the real account, which AdMob treats as invalid traffic and can
 * suspend the account for. Google's test unit is the safe default whenever
 * nothing else is certain.
 */
export const selectBannerUnitId = ({
  development,
  productionId,
  testId,
}: {
  development: boolean;
  productionId: string | undefined;
  testId: string;
}): string =>
  !development && productionId !== undefined ? productionId : testId;

// Waits grow so that a region with no fill (no ad to show) is asked less
// often the longer it stays empty. One entry is one retry.
const retryDelaysMs = [30_000, 120_000];

/** How many times a banner that failed to load is requested again. */
export const maxBannerRetries = retryDelaysMs.length;

/**
 * How long to wait before requesting a failed banner again.
 * @param {number} failures - How many requests have failed so far.
 * @returns {number | undefined} The wait in milliseconds, or undefined when no
 * retry is left.
 */
export const bannerRetryDelayMs = (failures: number): number | undefined =>
  failures >= 1 && failures <= maxBannerRetries
    ? retryDelaysMs[failures - 1]
    : undefined;
