import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PrivacyView } from "../views/PrivacyView";

/*
 * Component-level counterpart to acceptance/privacy-and-attribution.medium.test.ts
 * (Issue #10, rewritten for Issue #97). The acceptance test is the source of
 * truth for the contract; these Small tests exercise the same structural
 * contract against the component alone, without a browser, for fast feedback
 * while it is built.
 *
 * The page takes Figma's four section headings; the sentences under them are
 * the application's own accurate disclosure, moved under the matching heading
 * (owner decision on Issue #97, 2026-11-06). Regex patterns mirror
 * acceptance/selectors/privacy-selectors.ts by intent (subject plus, where the
 * criterion is a denial, a negative ending within one sentence) rather than by
 * import: application source does not depend on the acceptance/ directory,
 * which is Playwright-only and owned by a different role in this repository's
 * ATDD workflow.
 */
const headings = {
  collectedInformation: "1. 取得する情報",
  purposeOfUse: "2. 利用目的",
  advertisingAndAnalytics: "3. 広告とアクセス解析",
  history: "4. 履歴",
} as const;

const sectionOf = (name: string) => screen.getByRole("region", { name });

describe("PrivacyView", () => {
  test("has Figma's four section headings, each heading its own region, under the page's one h1", () => {
    render(<PrivacyView />);

    // ui-design.md section 8: one h1 per page. The disclosure's own sections
    // sit under the page title rather than beside it.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 1, name: "プライバシーポリシー" }),
    ).toBeInTheDocument();

    for (const name of Object.values(headings)) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
      expect(sectionOf(name)).toBeVisible();
    }
  });

  test("lists the sections in Figma's order", () => {
    render(<PrivacyView />);

    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(names).toEqual(Object.values(headings));
  });

  test("1. 取得する情報 states that no location, own identifier, or stored advertising identifier is collected", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.collectedInformation);

    expect(section).toHaveTextContent(
      /位置情報[^。]*(?:しません|していません|ありません|ない)/,
    );
    expect(section).toHaveTextContent(
      /(?:独自|自前|Zipnami)[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
    );
    expect(section).toHaveTextContent(
      /広告[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
    );
    // Each disclosure sits in the section it belongs to, not in all of them.
    expect(section).not.toHaveTextContent(/Google\s*(?:Maps|マップ)/i);
    expect(section).not.toHaveTextContent(/AdSense|アドセンス/i);
  });

  test("2. 利用目的 documents what Google Maps receives and when", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.purposeOfUse);

    expect(section).toHaveTextContent(/Google\s*(?:Maps|マップ)/i);
    // Issue #8 embeds the map, so the disclosure must describe it as in use.
    // It said "not yet implemented" until then, which would understate what
    // reaches Google from the moment a deployment supplies a key.
    expect(section).not.toHaveTextContent(/未実装|導入します/);
    expect(section).toHaveTextContent(/住所[^。]*Google[^。]*送信/);
  });

  // Issue #92: design.md section 8 names Google Analytics among the services
  // /privacy distinguishes from what Zipnami itself stores.
  test("3. 広告とアクセス解析 documents AdSense, Google Analytics, and consent", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.advertisingAndAnalytics);

    expect(section).toHaveTextContent(/AdSense|アドセンス/i);
    expect(section).toHaveTextContent(/同意|コンセント|Consent/i);
    expect(section).toHaveTextContent(/Google\s*Analytics/);
    // What is sent: pages visited, where the visit came from, device, region.
    expect(section).toHaveTextContent(
      /(?:ページ|閲覧)[^。]*(?:参照元|リファラ)[^。]*(?:端末|デバイス)[^。]*(?:地域|国)/,
    );
    expect(section).toHaveTextContent(/_ga\b/);
    expect(section).toHaveTextContent(/Cookie|クッキー/i);
    // The AdSense consent sentence also names these regions and consent, so
    // the measurement's own behavior there is told apart by its cookies.
    expect(section).toHaveTextContent(
      /欧州経済領域[^。]*英国[^。]*スイス[^。]*同意[^。]*Cookie/,
    );
    expect(section).toHaveTextContent(/オプトアウト/);
  });

  test("4. 履歴 documents that the history is saved in the browser and never sent to the server", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.history);

    // Both halves of the history statement are required within one sentence:
    // "履歴" alone would be satisfied by a page that never says where the
    // history lives.
    expect(section).toHaveTextContent(
      /履歴[^。]*(?:ブラウザ|端末)|(?:ブラウザ|端末)[^。]*履歴/,
    );
    // Issue #7 ships the history, so the disclosure must describe it as in
    // use. The production /privacy still called it "not yet implemented"
    // while the deployed site kept history (Issue #21's deployed check).
    // Banning the old phrases alone would let another "not available yet"
    // wording through, so the sentence must also say it is saved now.
    expect(section).not.toHaveTextContent(/未実装|実装後/);
    expect(section).toHaveTextContent(
      /履歴[^。]*ブラウザ[^。]*保存し(?!ていません|ません)/,
    );
    // The other half of the promise: history-storage.ts only touches
    // localStorage, so nothing of it reaches the Worker.
    expect(section).toHaveTextContent(
      /履歴[^。]*(?:サーバー|サーバ)[^。]*送信し(?:ません|ない)/,
    );
  });

  // The contact section is V2 work (Issue #105), so the MVP page carries no
  // contact link and no section for one.
  test("has no contact section or link in the MVP", () => {
    render(<PrivacyView />);

    expect(
      screen.queryByRole("link", { name: /問い合わせ|連絡先|Contact/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /お問い合わせ/ }),
    ).not.toBeInTheDocument();
  });
});
