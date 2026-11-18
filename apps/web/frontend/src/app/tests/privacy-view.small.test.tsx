import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PrivacyView } from "../views/PrivacyView";

/*
 * Component-level counterpart to acceptance/privacy-and-attribution.medium.test.ts
 * (Issue #10, rewritten for Issue #97). The acceptance test is the source of
 * truth for the contract; these Small tests exercise the same structural
 * contract against the component alone, without a browser, for fast feedback
 * while it is built.
 *
 * The page takes Figma's five section headings; the sentences under them are
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
  contact: "5. お問い合わせ",
} as const;

const sectionOf = (name: string) => screen.getByRole("region", { name });

describe("PrivacyView", () => {
  test("has Figma's five section headings, each heading its own region, under the page's one h1", () => {
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
    // Each disclosure sits in the section it belongs to, not in all of them.
    expect(section).not.toHaveTextContent(/AdSense|Analytics|アドセンス/i);
    expect(section).not.toHaveTextContent(/履歴|位置情報/);
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
    // Each disclosure sits in the section it belongs to, not in all of them.
    expect(section).not.toHaveTextContent(/Google\s*(?:Maps|マップ)/i);
    expect(section).not.toHaveTextContent(/履歴|位置情報/);
  });

  // Issue #20: the Google Play listing links this page as the Android app's
  // privacy policy, so it has to describe what the app does that the Web
  // site does not. Each statement keeps its subject in the sentence.
  test("3. 広告とアクセス解析 says the Android app shows Google AdMob ads that use the advertising ID", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.advertisingAndAnalytics);

    expect(section).toHaveTextContent(/Android[^。]*AdMob/);
    expect(section).toHaveTextContent(
      /(?:アプリ|AdMob)[^。]*広告ID|広告ID[^。]*(?:アプリ|AdMob)/,
    );
    // Zipnami's own API is outside what the advertising ID reaches.
    expect(section).toHaveTextContent(
      /広告ID[^。]*API[^。]*送信され(?:ません|ない)/,
    );
  });

  test("3. 広告とアクセス解析 says the Android app asks for consent before ads and otherwise shows non-personalized ads", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.advertisingAndAnalytics);

    expect(section).toHaveTextContent(
      /アプリ[^。]*欧州経済領域[^。]*英国[^。]*スイス[^。]*広告[^。]*同意/,
    );
    expect(section).toHaveTextContent(
      /アプリ[^。]*同意[^。]*パーソナライズ[^。]*されていない広告/,
    );
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
    // Each disclosure sits in the section it belongs to, not in all of them.
    expect(section).not.toHaveTextContent(/AdSense|Analytics|アドセンス/i);
    expect(section).not.toHaveTextContent(/Google\s*(?:Maps|マップ)|Cookie/i);
  });

  test("4. 履歴 says the Android app keeps its history on the device and never sends it to the server", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.history);

    expect(section).toHaveTextContent(
      /アプリ[^。]*履歴[^。]*(?:端末|デバイス)|アプリ[^。]*(?:端末|デバイス)[^。]*履歴/,
    );
    expect(section).toHaveTextContent(
      /アプリ[^。]*履歴[^。]*(?:サーバー|サーバ)[^。]*送信し(?:ません|ない)/,
    );
  });

  // Issue #105: the contact method is a Google Form, linked and not embedded.
  test("5. お問い合わせ links once to the Google Form and says how what is entered is used", () => {
    render(<PrivacyView />);

    const section = sectionOf(headings.contact);

    // One link only: the form is the single means of contact.
    expect(within(section).getAllByRole("link")).toHaveLength(1);
    expect(
      within(section).getByRole("link", { name: "お問い合わせフォーム" }),
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/docs\.google\.com\/forms\//),
    );
    // "Googleフォーム" alone would match a looser pattern, even in a sentence
    // denying its use, so the sentence must say Google provides it.
    expect(section).toHaveTextContent(
      /Google[^。]*(?:提供|サービス)[^。]*フォーム/,
    );
    // The form's three questions, so a visitor knows a name is asked for.
    expect(section).toHaveTextContent(/名前[^。]*問い合わせの種類[^。]*内容/);
    expect(section).toHaveTextContent(
      /入力[^。]*問い合わせ[^。]*(?:利用|使用)/,
    );
    // The form collects no email address, so the page must not promise one.
    expect(section).toHaveTextContent(/返信[^。]*(?:できません|しません)/);
    // Each disclosure sits in the section it belongs to, not in all of them.
    expect(section).not.toHaveTextContent(/AdSense|Analytics|履歴|位置情報/i);
  });
});
