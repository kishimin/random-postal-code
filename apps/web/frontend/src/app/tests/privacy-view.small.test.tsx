import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PrivacyView } from "../views/PrivacyView";

/*
 * Component-level counterpart to acceptance/privacy-and-attribution.medium.test.ts
 * (Issue #10). The acceptance test is the source of truth for the contract;
 * these Small tests exercise the same structural contract against the
 * component alone, without a browser, for fast feedback while it is built.
 *
 * Regex patterns mirror acceptance/selectors/privacy-selectors.ts by intent
 * (subject plus, where the criterion is a denial, a negative ending within one
 * sentence) rather than by import: application source does not depend on the
 * acceptance/ directory, which is Playwright-only and owned by a different
 * role in this repository's ATDD workflow.
 */
describe("PrivacyView", () => {
  test("separates what Zipnami stores from what third-party services process", () => {
    render(<PrivacyView />);

    // ui-design.md section 8: one h1 per page. The disclosure's own sections
    // sit under the page title rather than beside it.
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

    const firstPartySection = screen.getByRole("region", {
      name: /Zipnami.*(?:保存|記録)/,
    });
    const thirdPartySection = screen.getByRole("region", {
      name: /第三者|サードパーティ|外部サービス/,
    });

    expect(firstPartySection).toBeVisible();
    expect(thirdPartySection).toBeVisible();

    // "Contains its own content" alone would also be satisfied by a page that
    // duplicated every sentence into both sections, which would still pass
    // every "contains" assertion in this file while failing what AC-2 asks
    // for: distinguishing the two. These negative assertions are what close
    // that gap (TR-001).
    expect(firstPartySection).not.toHaveTextContent(
      /Google\s*(?:Maps|マップ)/i,
    );
    expect(firstPartySection).not.toHaveTextContent(/AdSense|アドセンス/i);
    expect(firstPartySection).not.toHaveTextContent(/同意|コンセント|Consent/i);

    expect(thirdPartySection).not.toHaveTextContent(
      /履歴[^。]*(?:ブラウザ|端末)|(?:ブラウザ|端末)[^。]*履歴/,
    );
    expect(thirdPartySection).not.toHaveTextContent(
      /位置情報[^。]*(?:しません|していません|ありません|ない)/,
    );
    expect(thirdPartySection).not.toHaveTextContent(
      /(?:独自|自前|Zipnami)[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
    );
    expect(thirdPartySection).not.toHaveTextContent(
      /広告[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
    );
  });

  test("the third-party section documents Google Maps, Google AdSense, and consent", () => {
    render(<PrivacyView />);

    const thirdPartySection = screen.getByRole("region", {
      name: /第三者|サードパーティ|外部サービス/,
    });

    expect(thirdPartySection).toHaveTextContent(/Google\s*(?:Maps|マップ)/i);
    expect(thirdPartySection).toHaveTextContent(/AdSense|アドセンス/i);
    expect(thirdPartySection).toHaveTextContent(/同意|コンセント|Consent/i);
  });

  test("the Zipnami section documents the browser-local history and that no location is collected", () => {
    render(<PrivacyView />);

    const firstPartySection = screen.getByRole("region", {
      name: /Zipnami.*(?:保存|記録)/,
    });

    // Both halves of the history statement are required within one sentence:
    // "履歴" alone would be satisfied by a page that never says where the
    // history lives.
    expect(firstPartySection).toHaveTextContent(
      /履歴[^。]*(?:ブラウザ|端末)|(?:ブラウザ|端末)[^。]*履歴/,
    );
    expect(firstPartySection).toHaveTextContent(
      /位置情報[^。]*(?:しません|していません|ありません|ない)/,
    );
  });

  test("the Zipnami section states that no identifier of its own is issued and no advertising identifier is stored", () => {
    render(<PrivacyView />);

    const firstPartySection = screen.getByRole("region", {
      name: /Zipnami.*(?:保存|記録)/,
    });

    expect(firstPartySection).toHaveTextContent(
      /(?:独自|自前|Zipnami)[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
    );
    expect(firstPartySection).toHaveTextContent(
      /広告[^。]*(?:識別子|ID)[^。]*(?:しません|していません|ありません|ない)/i,
    );
  });

  test("offers a contact method a keyboard user can reach and operate", () => {
    render(<PrivacyView />);

    const contactLink = screen.getByRole("link", {
      name: /(?:お)?問(?:い)?合(?:わ)?せ|連絡先|Contact/i,
    });

    // A destination rather than a placeholder: without this, `href="#"`
    // would satisfy "provides a contact method".
    expect(contactLink).toHaveAttribute(
      "href",
      expect.stringMatching(/^(?:mailto:|https:\/\/)\S/),
    );

    // Not removed from the tab order (a positive tabIndex is also disallowed
    // by this repository's accessibility contract; a native link's default
    // tabIndex of 0 already keeps it keyboard-reachable).
    expect(contactLink.tabIndex).toBeGreaterThan(-1);
  });
});
