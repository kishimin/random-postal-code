import { Fragment } from "react";
import { postalGeneratorText } from "../../features/postal-generator/site-text";
import { siteText } from "../site-text";

type GeneratorHeroProps = {
  /** Once a result is on screen the hero gives way to the result's headline. */
  hasResult: boolean;
};

type LinesProps = {
  lines: readonly string[];
};

// Figma sets the headline and body with deliberate line breaks.
const Lines = ({ lines }: LinesProps) =>
  lines.map((line, index) => (
    <Fragment key={line}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));

const { startHeadline, startBody } = postalGeneratorText;

const bodyClass =
  "mx-auto mt-6 max-w-[720px] text-body-sm text-ink-muted md:text-body";

/**
 * The generator's page heading and introduction.
 *
 * tabIndex on the h1: RootLayout focuses a screen's own h1 after a
 * client-side route change (Issue #16 AC-5), and a plain heading is not in
 * the focusable area without one.
 *
 * The h1 is named after the product (Issue #6) and shows Figma's headline: the
 * product name is visually hidden text inside it, so the accessible name is
 * "Zipnami" followed by the visible words, which WCAG 2.5.3 allows for a
 * heading as it does for a control. Figma's copy differs per width, so the
 * variants for the other widths are not rendered (display: none) rather than
 * merely clipped.
 */
export const GeneratorHero = ({ hasResult }: GeneratorHeroProps) => {
  if (hasResult) {
    return (
      <h1 tabIndex={-1} className={"sr-only"}>
        {siteText.name}
      </h1>
    );
  }

  return (
    <div className={"text-center"}>
      <p
        className={
          "text-caption-sm font-bold tracking-widest text-ink-muted lg:text-eyebrow"
        }
      >
        {postalGeneratorText.eyebrow}
      </p>
      <h1
        tabIndex={-1}
        className={
          "mt-4 text-display-sm font-bold text-balance text-ink md:text-display-md lg:text-display"
        }
      >
        <span className={"sr-only"}>{`${siteText.name} `}</span>
        <span className={"md:hidden"}>
          <Lines lines={startHeadline.compact} />
        </span>
        <span className={"hidden md:inline"}>
          <Lines lines={startHeadline.regular} />
        </span>
      </h1>
      <p className={`${bodyClass} md:hidden`}>
        <Lines lines={startBody.compact} />
      </p>
      <p className={`${bodyClass} hidden md:block lg:hidden`}>
        <Lines lines={startBody.regular} />
      </p>
      <p className={`${bodyClass} hidden lg:block`}>
        <Lines lines={startBody.wide} />
      </p>
    </div>
  );
};
