import { render, screen } from "@testing-library/react";
import type { PostalCode } from "@zipnami/shared";
import { describe, expect, test } from "vitest";
import { postalGeneratorText } from "../site-text";
import { CurrentResult } from "./CurrentResult";

const result: PostalCode = {
  postalCode: "1000001",
  addresses: [{ prefecture: "東京都", city: "千代田区", town: "千代田" }],
};

describe("CurrentResult", () => {
  // Always mounted, even with nothing to report yet -- the same reason
  // GeneratorAnnouncer stays mounted while empty (its own docstring): a
  // region assistive technology has not yet registered as live cannot be
  // relied on to announce the text it is born already containing, so the
  // first copy attempt's feedback needs this region to already exist.
  test("keeps an empty copy-feedback status mounted when there is nothing to report", () => {
    render(
      <CurrentResult
        result={result}
        onCopy={() => undefined}
        copyFeedback={""}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  // PR #36 review found the copy failure announced only in the live region
  // GeneratorView renders below the whole current-result section -- past
  // every returned address on a result with many of them. ui-design.md
  // section 5.3: "Copy failure leaves the result usable and offers a concise
  // error near the action." A visitor who stayed near the copy button never
  // scrolls to where that error was rendered.
  test("shows a copy failure message immediately after the copy action, before the address list", () => {
    render(
      <CurrentResult
        result={result}
        onCopy={() => undefined}
        copyFeedback={postalGeneratorText.copyFailureAnnouncement}
      />,
    );

    const copyButton = screen.getByRole("button", {
      name: postalGeneratorText.copyLabel,
    });
    const feedback = screen.getByRole("status");
    const addressList = screen.getByRole("list");

    expect(feedback).toHaveTextContent(
      postalGeneratorText.copyFailureAnnouncement,
    );
    expect(
      Boolean(
        copyButton.compareDocumentPosition(feedback) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        feedback.compareDocumentPosition(addressList) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });
});
