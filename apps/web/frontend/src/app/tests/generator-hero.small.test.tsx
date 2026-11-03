import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { postalGeneratorText } from "../../features/postal-generator/site-text";
import { siteText } from "../site-text";
import { GeneratorHero } from "../views/GeneratorHero";

describe("GeneratorHero", () => {
  // Issue #6 names the page's h1 after the product; Issue #97 puts Figma's
  // headline inside it. The name has to carry both.
  test("names the h1 after the product and the headline before any result", () => {
    render(<GeneratorHero hasResult={false} />);

    const heading = screen.getByRole("heading", { level: 1 });

    expect(heading).toHaveTextContent(siteText.name);
    expect(heading).toHaveTextContent(
      postalGeneratorText.startHeadline.regular.join(""),
    );
  });

  test("offers the introduction in each width Figma writes it for", () => {
    render(<GeneratorHero hasResult={false} />);

    for (const lines of Object.values(postalGeneratorText.startBody)) {
      expect(
        screen.getByText(lines[0] ?? "", { exact: false }),
      ).toBeInTheDocument();
    }
  });

  // The result screens show a different headline, but the page still needs
  // exactly one h1 named after the product.
  test("keeps only the product-named h1 once a result is on screen", () => {
    render(<GeneratorHero hasResult={true} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      siteText.name,
    );
    expect(
      screen.queryByText(postalGeneratorText.eyebrow),
    ).not.toBeInTheDocument();
  });
});
