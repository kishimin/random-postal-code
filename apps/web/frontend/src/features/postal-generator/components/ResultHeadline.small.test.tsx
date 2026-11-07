import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RESULT_HEADING_ID, ResultHeadline } from "./ResultHeadline";

describe("ResultHeadline", () => {
  // WCAG 1.3.1: the result keeps a heading at every width, named by Figma's
  // headline (Issue #97). On a phone it is only visually hidden.
  test("is a second-level heading named after Figma's headline, with the id the result card is labelled by", () => {
    render(<ResultHeadline />);

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "波が運んできた場所",
    });
    expect(heading).toHaveAttribute("id", RESULT_HEADING_ID);
  });

  // Figma #2:19 sits above #2:20.
  test("puts the eyebrow before the headline", () => {
    render(<ResultHeadline />);

    const eyebrow = screen.getByText("TODAY'S DESTINATION");
    const heading = screen.getByRole("heading", { level: 2 });
    expect(
      Boolean(
        eyebrow.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });
});
