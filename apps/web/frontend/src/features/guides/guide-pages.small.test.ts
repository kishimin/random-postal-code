import { describe, expect, test } from "vitest";
import {
  allGuidePages,
  guideCategories,
  guideIndexPage,
  guidePageAt,
  guidePages,
  relatedGuidesHeading,
  sourcesHeading,
} from "./guide-pages";
import type { GuidePage } from "./types";

/*
 * ui-design.md section 5.5 ("Content rules", "Guide index and categories")
 * fixes what the guides may say and how they are grouped. A reader's
 * judgement settles whether the copy is original and true to its sources;
 * what a test can hold is the structure the contract requires and the facts
 * the copy states about Zipnami's own dataset. Those dataset facts are
 * checked against the dataset itself by
 * apps/web/backend/src/data/guide-copy-facts.medium.test.ts, which this
 * workspace cannot load (the dataset is 13 MB).
 */
const officialOrigins = [
  "https://www.post.japanpost.jp/",
  "https://www.soumu.go.jp/",
];

const contactPattern = /お問い合わせ|連絡先|mailto:|@/;

// Every sentence a visitor reads in the page's body sections, in one string.
const bodyOf = (page: GuidePage): string =>
  page.sections
    .flatMap((section) => [...section.paragraphs, ...(section.items ?? [])])
    .join("\n");

// The lead and the body, which is everything the page's own copy states.
const textOf = (page: GuidePage): string =>
  [page.lead, bodyOf(page)].join("\n");

// Counted as the contract counts body text: no whitespace, in code points.
const characterCount = (text: string): number =>
  [...text.replace(/\s/g, "")].length;

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

  test("names the sources section 参考にした資料 and the related section 関連するガイド", () => {
    expect(sourcesHeading).toBe("参考にした資料");
    expect(relatedGuidesHeading).toBe("関連するガイド");
  });
});

describe("guideCategories", () => {
  test("groups the ten guides into the contract's three categories, in its order", () => {
    expect(
      guideCategories.map(({ name, pages }) => ({
        name,
        pages: pages.map(({ name: pageName, path }) => ({
          name: pageName,
          path,
        })),
      })),
    ).toEqual([
      {
        name: "Zipnamiについて",
        pages: [
          { name: "サイトについて", path: "/about" },
          { name: "使い方", path: "/guide/how-to-use" },
          { name: "データについて", path: "/guide/data" },
        ],
      },
      {
        name: "郵便番号の基本",
        pages: [
          { name: "郵便番号のしくみ", path: "/guide/postal-code" },
          { name: "郵便番号と住所", path: "/guide/address" },
          { name: "7桁の郵便番号になるまで", path: "/guide/history" },
          { name: "郵便番号の書き方と調べ方", path: "/guide/writing" },
        ],
      },
      {
        name: "郵便番号をもっと詳しく",
        pages: [
          { name: "事業所の個別郵便番号", path: "/guide/business-code" },
          { name: "郵便番号とバーコード", path: "/guide/barcode" },
          {
            name: "郵便番号と地方公共団体コード",
            path: "/guide/municipality-code",
          },
        ],
      },
    ]);
  });

  test("describes each category in a sentence of its own", () => {
    const descriptions = guideCategories.map(({ description }) => description);

    for (const description of descriptions) {
      expect(description.length).toBeGreaterThan(20);
    }
    expect(new Set(descriptions).size).toBe(guideCategories.length);
  });

  test("allGuidePages is every categorized guide once, in the categories' order", () => {
    expect(allGuidePages).toEqual(
      guideCategories.flatMap(({ pages }) => pages),
    );
    expect(new Set(allGuidePages.map(({ path }) => path)).size).toBe(10);
  });
});

describe("guideIndexPage", () => {
  test("is ガイド一覧 at /guide, with its own lead and description", () => {
    expect(guideIndexPage.name).toBe("ガイド一覧");
    expect(guideIndexPage.path).toBe("/guide");
    expect(guideIndexPage.lead).not.toBe("");
    expect(allGuidePages.map(({ description }) => description)).not.toContain(
      guideIndexPage.description,
    );
  });
});

describe("guidePageAt", () => {
  test.each(allGuidePages)("finds $path by its route", (page) => {
    expect(guidePageAt(page.path)).toBe(page);
  });
});

describe("every guide", () => {
  test.each(allGuidePages)(
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
    },
  );

  test("no two sections of any guide share a heading id, so every region is named by its own h2", () => {
    const ids = allGuidePages.flatMap((page) =>
      page.sections.map((section) => section.headingId),
    );

    expect(new Set(ids).size, JSON.stringify(ids)).toBe(ids.length);
  });

  test.each(allGuidePages)(
    "$path has at least 2,000 characters of body text, without the lead",
    (page) => {
      expect(characterCount(bodyOf(page))).toBeGreaterThanOrEqual(2000);
    },
  );

  test("no paragraph or list item appears on two guides", () => {
    const pagesOf = new Map<string, string[]>();

    for (const page of allGuidePages) {
      const texts = [
        page.lead,
        ...page.sections.flatMap((section) => [
          ...section.paragraphs,
          ...(section.items ?? []),
        ]),
      ];
      for (const text of new Set(texts)) {
        pagesOf.set(text, [...(pagesOf.get(text) ?? []), page.path]);
      }
    }

    expect([...pagesOf].filter(([, paths]) => paths.length > 1)).toEqual([]);
  });

  test.each(allGuidePages)(
    "$path names at least two other guides as related, each once",
    (page) => {
      const others = allGuidePages
        .map(({ path }) => path)
        .filter((path) => path !== page.path);

      expect(page.related.length).toBeGreaterThanOrEqual(2);
      expect(new Set(page.related).size).toBe(page.related.length);
      for (const path of page.related) {
        expect(others, path).toContain(path);
      }
    },
  );

  test.each(allGuidePages)(
    "$path cites only official sources, each as an https link",
    (page) => {
      expect(page.sources.length).toBeGreaterThan(0);

      for (const source of page.sources) {
        expect(source.label, source.href).not.toBe("");
        expect(
          officialOrigins.some((origin) => source.href.startsWith(origin)),
          source.href,
        ).toBe(true);
      }
      expect(new Set(page.sources.map(({ href }) => href)).size).toBe(
        page.sources.length,
      );
    },
  );

  test.each(allGuidePages)(
    "$path has a summary for the index and the related links",
    (page) => {
      expect(page.summary.length).toBeGreaterThan(10);
    },
  );

  test("gives each guide its own one-sentence description, different from every other", () => {
    const descriptions = allGuidePages.map((page) => page.description);

    for (const description of descriptions) {
      expect(description).not.toBe("");
    }
    expect(new Set(descriptions).size).toBe(allGuidePages.length);
  });

  test.each(allGuidePages)(
    "$path publishes no means of contact (owner decision on Issue #121)",
    (page) => {
      expect(textOf(page)).not.toMatch(contactPattern);
      expect(page.description).not.toMatch(contactPattern);
      for (const source of page.sources) {
        expect(source.href).not.toMatch(contactPattern);
      }
    },
  );

  // ui-design.md section 5.5 forbids what no source states, the start date
  // of the postal code system among it.
  test.each(allGuidePages)(
    "$path does not date the start of the postal code system",
    (page) => {
      expect(textOf(page)).not.toMatch(/昭和43年|1968年/);
    },
  );
});

describe("/guide/data", () => {
  // packages/postal-data/README.md records the retrieval and the counts.
  test("states the retrieval date and the counts the dataset README records", () => {
    const text = textOf(guidePageAt("/guide/data"));

    expect(text).toContain("2026年11月3日");
    expect(text).toContain("124,841行");
    expect(text).toContain("120,721件の郵便番号");
    expect(text).toContain("124,526件の住所");
    expect(text).toContain("1,338件");
  });

  test("says the data is updated by hand with no fixed schedule, never continuously", () => {
    const text = textOf(guidePageAt("/guide/data"));

    expect(text).toContain("自動では更新されません");
    expect(text).toContain("決まった更新日はありません");
    expect(text).not.toMatch(/継続的|常に最新|毎月更新|定期的に更新/);
  });
});

// Each fragment is an example worded as the guides word it. The backend test
// holds that the dataset says the same.
describe("dataset examples", () => {
  test.each([
    ["/guide/postal-code", "東京都千代田区千代田の郵便番号は 100-0001"],
    ["/guide/postal-code", "1丁目が 103-0028、2丁目が 104-0028"],
    ["/guide/postal-code", "1階が 100-6001、2階が 100-6002"],
    ["/guide/postal-code", "100-6090"],
    ["/guide/postal-code", "060-0906"],
    ["/guide/postal-code", "065-0006"],
    ["/guide/address", "120,721件の郵便番号のうち1,338件"],
    [
      "/guide/address",
      "498-0000 は、愛知県弥富市と三重県桑名郡木曽岬町の両方に対応",
    ],
    ["/guide/address", "340-0000 は「埼玉県草加市」と表示されます"],
    ["/guide/address", "038-3802"],
    ["/guide/history", "154-0023 は「東京都世田谷区若林」"],
    ["/guide/history", "350-1106 は「埼玉県川越市小室」"],
    ["/guide/writing", "100-0013"],
    ["/guide/writing", "790-0066"],
    ["/guide/writing", "333-0823 を引くと「埼玉県川口市石神」"],
    ["/guide/writing", "966-0049"],
    ["/guide/writing", "滋賀県草津市は 525-0000、埼玉県和光市は 351-0100"],
    ["/guide/municipality-code", "13101"],
    ["/guide/municipality-code", "01103"],
  ] as const)("%s cites the example %s", (path, fragment) => {
    expect(textOf(guidePageAt(path))).toContain(fragment);
  });

  // The guides never write a code outside the dataset in the NNN-NNNN form
  // (ui-design.md section 5.5). These are the codes they may write; the
  // backend test holds each one against the dataset.
  test("writes no NNN-NNNN code other than the dataset entries the backend test holds", () => {
    const allowed = new Set([
      "100-0001",
      "103-0028",
      "104-0028",
      "100-6001",
      "100-6002",
      "100-6090",
      "060-0906",
      "065-0006",
      "498-0000",
      "340-0000",
      "038-3802",
      "154-0023",
      "350-1106",
      "100-0013",
      "790-0066",
      "333-0823",
      "966-0049",
      "525-0000",
      "351-0100",
    ]);
    const written = allGuidePages.flatMap(
      (page) => textOf(page).match(/(?<![\d-])\d{3}-\d{4}(?![\d-])/g) ?? [],
    );

    expect(written.filter((code) => !allowed.has(code))).toEqual([]);
  });
});
