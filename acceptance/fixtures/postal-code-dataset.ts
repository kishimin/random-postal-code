import type { PostalCode } from "@zipnami/shared";

/*
 * Hand-built postal-code collections for the Issue #4 acceptance test.
 *
 * These are not a slice of the real Japan Post dataset. The real archive is
 * not retrievable in this repository yet — Issue #34 owns fetching and
 * Shift-JIS-decoding it — so an acceptance test that required it could not run
 * at all. A real slice would also be the wrong input: it proves nothing in
 * particular, whereas every entry below exists to make one acceptance
 * criterion fail loudly when it is broken.
 *
 * The values are the normalized output of the Issue #3 fixture
 * (./japan-post-ken-all-excerpt.csv), so the two acceptance tests describe one
 * dataset rather than two unrelated ones.
 */

/**
 * Five unique postal codes, the collection the endpoint selects from.
 *
 *   0600000  one address, leading zero. A seven-digit code that a numeric
 *            round-trip would return as 600000.
 *   0640941  one address, leading zero, sharing a prefecture and city with
 *            0600000 so a response cannot be assembled by city.
 *   3620000  two addresses differing by city.
 *   3670030  two addresses differing by town, the second sorting first by
 *            code point, so a response that re-sorts them is visible.
 *   4980000  two addresses differing by prefecture, the second sorting first
 *            by code point.
 *
 * The three multi-address entries are what makes "every returned postal code
 * has at least one complete address" more than a shape check: an endpoint that
 * collapsed a group to one representative address would still pass the shared
 * contract and still fail here.
 */
export const normalizedPostalCodes: readonly PostalCode[] = [
  {
    postalCode: "0600000",
    addresses: [
      {
        prefecture: "北海道",
        city: "札幌市中央区",
        town: "以下に掲載がない場合",
      },
    ],
  },
  {
    postalCode: "0640941",
    addresses: [{ prefecture: "北海道", city: "札幌市中央区", town: "旭ケ丘" }],
  },
  {
    postalCode: "3620000",
    addresses: [
      { prefecture: "埼玉県", city: "上尾市", town: "以下に掲載がない場合" },
      {
        prefecture: "埼玉県",
        city: "北足立郡伊奈町",
        town: "以下に掲載がない場合",
      },
    ],
  },
  {
    postalCode: "3670030",
    addresses: [
      { prefecture: "埼玉県", city: "本庄市", town: "朝日町" },
      { prefecture: "埼玉県", city: "本庄市", town: "早稲田の杜" },
    ],
  },
  {
    postalCode: "4980000",
    addresses: [
      { prefecture: "愛知県", city: "弥富市", town: "以下に掲載がない場合" },
      {
        prefecture: "三重県",
        city: "桑名郡木曽岬町",
        town: "以下に掲載がない場合",
      },
    ],
  },
];

/** The postal code in {@link unevenlySizedPostalCodes} that has one address. */
export const oneAddressPostalCode = "1000001";

/** The postal code in {@link unevenlySizedPostalCodes} that has eight. */
export const eightAddressPostalCode = "9800000";

/*
 * Two postal codes whose address counts differ by a factor of eight.
 *
 * Issue #3 already removes duplicate source records while building the
 * dataset, so duplication cannot reach the endpoint as repeated entries. What
 * can still reach it is the shape duplication leaves behind: one postal code
 * carrying many more address rows than another. An implementation that drew
 * from the rows instead of from the unique postal codes would return
 * 9800000 eight times as often as 1000001 — 89% against 11% — while an
 * implementation that draws from the collection returns each about half the
 * time. Two entries rather than five keeps that gap at its widest, so the
 * distribution check needs few enough draws to stay fast and far enough from
 * the threshold to never flake.
 */
export const unevenlySizedPostalCodes: readonly PostalCode[] = [
  {
    postalCode: oneAddressPostalCode,
    addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
  },
  {
    postalCode: eightAddressPostalCode,
    addresses: [
      {
        prefecture: "宮城県",
        city: "仙台市青葉区",
        town: "以下に掲載がない場合",
      },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "青葉町" },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "荒巻" },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "一番町" },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "大町" },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "春日町" },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "上杉" },
      { prefecture: "宮城県", city: "仙台市青葉区", town: "木町通" },
    ],
  },
];
