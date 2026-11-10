import { describe, expect, test } from "vitest";
import { guidePages, sourcesHeading } from "./guide-pages";
import type { GuidePage } from "./types";

/*
 * ui-design.md section 5.5 ("Content rules") fixes what the five guides may
 * say. A reader's judgement settles whether the copy is original and true to
 * Japan Post's pages; what a test can hold is the structure the contract
 * requires and the facts the copy states about Zipnami's own dataset. Those
 * dataset facts are checked against the dataset itself by
 * apps/web/backend/src/data/guide-copy-facts.medium.test.ts, which this
 * workspace cannot load (the dataset is 13 MB).
 */
const japanPostOrigin = "https://www.post.japanpost.jp/";

const contactPattern = /お問い合わせ|連絡先|mailto:|@/;

const pageAt = (path: GuidePage["path"]): GuidePage => {
  const page = guidePages.find((candidate) => candidate.path === path);

  if (!page) {
    throw new Error(`No guide is listed at ${path}.`);
  }

  return page;
};

// Every sentence a visitor reads on the page, in one string.
const textOf = (page: GuidePage): string =>
  [
    page.lead,
    ...page.sections.flatMap((section) => [
      ...section.paragraphs,
      ...(section.items ?? []),
    ]),
  ].join("\n");

describe("guidePages", () => {
  test("lists the five guides in the footer's order, each by its own name and route", () => {
    expect(guidePages.map(({ name, path }) => ({ name, path }))).toEqual([
      { name: "サイトについて", path: "/about" },
      { name: "郵便番号のしくみ", path: "/guide/postal-code" },
      { name: "郵便番号と住所", path: "/guide/address" },
      { name: "データについて", path: "/guide/data" },
      { name: "使い方", path: "/guide/how-to-use" },
    ]);
  });

  test("names the sources section 参考にした資料", () => {
    expect(sourcesHeading).toBe("参考にした資料");
  });

  test.each(guidePages)(
    "$path has a lead and at least two body sections that each say something under a heading of their own",
    (page) => {
      expect(page.lead).not.toBe("");
      expect(page.sections.length).toBeGreaterThanOrEqual(2);

      for (const section of page.sections) {
        expect(section.heading, section.headingId).not.toBe("");
        expect(
          section.paragraphs.length + (section.items?.length ?? 0),
          section.headingId,
        ).toBeGreaterThan(0);
      }

      const ids = page.sections.map((section) => section.headingId);
      expect(new Set(ids).size, JSON.stringify(ids)).toBe(ids.length);
    },
  );

  test.each(guidePages)(
    "$path cites Japan Post among its sources, each as an https link",
    (page) => {
      expect(page.sources.length).toBeGreaterThan(0);
      expect(
        page.sources.some((source) => source.href.startsWith(japanPostOrigin)),
      ).toBe(true);

      for (const source of page.sources) {
        expect(source.label, source.href).not.toBe("");
        expect(source.href.startsWith("https://"), source.href).toBe(true);
      }
    },
  );

  test("gives each guide its own one-sentence description, different from the other four", () => {
    const descriptions = guidePages.map((page) => page.description);

    for (const description of descriptions) {
      expect(description).not.toBe("");
    }
    expect(new Set(descriptions).size).toBe(guidePages.length);
  });

  test.each(guidePages)(
    "$path publishes no means of contact (owner decision on Issue #121)",
    (page) => {
      expect(textOf(page)).not.toMatch(contactPattern);
      expect(page.description).not.toMatch(contactPattern);
      for (const source of page.sources) {
        expect(source.href).not.toMatch(contactPattern);
      }
    },
  );

  // packages/postal-data/README.md records the retrieval and the counts.
  test("/guide/data states the retrieval date and the counts the dataset README records", () => {
    const text = textOf(pageAt("/guide/data"));

    expect(text).toContain("2026年11月3日");
    expect(text).toContain("124,841行");
    expect(text).toContain("120,721件の郵便番号");
    expect(text).toContain("124,526件の住所");
    expect(text).toContain("1,338件");
  });

  test("/guide/data says the data is updated by hand with no fixed schedule, never continuously", () => {
    const text = textOf(pageAt("/guide/data"));

    expect(text).toContain("自動では更新されません");
    expect(text).toContain("決まった更新日はありません");
    expect(text).not.toMatch(/継続的|常に最新|毎月更新|定期的に更新/);
  });

  // Each fragment is an example worded as the guides word it. The backend
  // test holds that the dataset says the same.
  test.each([
    ["/guide/postal-code", "東京都千代田区千代田の郵便番号は 100-0001"],
    ["/guide/postal-code", "1丁目が 103-0028、2丁目が 104-0028"],
    ["/guide/postal-code", "1階が 100-6001、2階が 100-6002"],
    ["/guide/postal-code", "100-6090"],
    ["/guide/address", "120,721件の郵便番号のうち1,338件"],
    [
      "/guide/address",
      "498-0000 は、愛知県弥富市と三重県桑名郡木曽岬町の両方に対応",
    ],
    ["/guide/address", "340-0000 は「埼玉県草加市」と表示されます"],
  ] as const)("%s cites the example %s", (path, fragment) => {
    expect(textOf(pageAt(path))).toContain(fragment);
  });
});
