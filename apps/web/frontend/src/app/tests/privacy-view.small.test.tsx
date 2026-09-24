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
});
