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

  // Figma's result frames state how many addresses the code covers.
  test("states how many addresses the postal code corresponds to", () => {
    render(
      <CurrentResult
        result={{
          postalCode: "5300001",
          addresses: [
            { prefecture: "大阪府", city: "大阪市北区", town: "梅田" },
            { prefecture: "大阪府", city: "大阪市北区", town: "中之島" },
          ],
        }}
        onCopy={() => undefined}
        copyFeedback={""}
      />,
    );

    expect(
      screen.getByText("対応する住所 2件", { exact: false }),
    ).toBeInTheDocument();
  });

  // Issue #111: Figma draws an area line under the postal code. Which
  // components it joins is sharedArea's rule; this holds where it goes.
  test("shows the shared area under the postal code, before the address count", () => {
    render(
      <CurrentResult
        result={{
          postalCode: "9012223",
          addresses: [
            { prefecture: "沖縄県", city: "宜野湾市", town: "大山1丁目" },
            { prefecture: "沖縄県", city: "宜野湾市", town: "大山2丁目" },
          ],
        }}
        onCopy={() => undefined}
        copyFeedback={""}
      />,
    );

    const postalCode = screen.getByText("901-2223");
    const areaLine = screen.getByText("沖縄県宜野湾市");
    const count = screen.getByText("対応する住所 2件", { exact: false });

    expect(
      Boolean(
        postalCode.compareDocumentPosition(areaLine) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        areaLine.compareDocumentPosition(count) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  test("shows no area line when the addresses share no prefecture", () => {
    render(
      <CurrentResult
        result={{
          postalCode: "4980000",
          addresses: [
            { prefecture: "愛知県", city: "弥富市", town: "鍋田町" },
            { prefecture: "三重県", city: "桑名郡木曽岬町", town: "源緑輪中" },
          ],
        }}
        onCopy={() => undefined}
        copyFeedback={""}
      />,
    );

    // Only the list items carry a prefecture, so nothing outside them does.
    const outsideList = screen
      .getAllByText(/愛知県|三重県/)
      .filter((element) => element.closest("li") === null);
    expect(outsideList).toHaveLength(0);
  });

  // The headline moved above both the card and the map (Issue #111), so it
  // is ResultHeadline's, not this component's.
  test("carries no heading of its own", () => {
    render(
      <CurrentResult
        result={result}
        onCopy={() => undefined}
        copyFeedback={""}
      />,
    );

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  // Issue #8 places a per-address map action inside AddressList's own
  // entries; CurrentResult sits between GeneratorView and AddressList, so it
  // has to pass the slot through rather than swallow it.
  test("forwards renderAddressExtra through to each address's own entry", () => {
    render(
      <CurrentResult
        result={result}
        onCopy={() => undefined}
        copyFeedback={""}
        renderAddressExtra={(address) => <span>{`extra:${address.town}`}</span>}
      />,
    );

    expect(screen.getByText("extra:千代田")).toBeInTheDocument();
  });
});
