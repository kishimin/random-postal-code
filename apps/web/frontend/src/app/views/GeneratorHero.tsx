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

// Figma sets the body with deliberate line breaks.
const Lines = ({ lines }: LinesProps) =>
  lines.map((line, index) => (
    <Fragment key={line}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));

/*
 * Figma sets the headline with a deliberate break too, but the h1's accessible
 * name has to be exactly the headline (Issue #97), and a <br>, like any
 * element that is not inline, reads as a space in an accessible name. Each
 * line is an inline span that cannot wrap inside itself instead, so the
 * headline breaks between Figma's lines when the width calls for it and
 * nowhere else.
 */
const HeadlineLines = ({ lines }: LinesProps) =>
  lines.map((line) => (
    <span key={line} className={"whitespace-nowrap"}>
      {line}
    </span>
  ));

const { startHeadline, startBody } = postalGeneratorText;

const bodyClass =
  "mx-auto mt-6 max-w-[720px] text-body-sm text-ink-muted md:text-body";

/**
 * The generator's page heading and introduction.
 *
 * tabIndex on the h1: RootLayout focuses a screen's own h1 after a
 * client-side route change (Issue #16 AC-5), and a plain heading is not in the
 * focusable area without one.
 *
 * Before a result the h1 is Figma's headline and nothing else, so its
 * accessible name is the words a visitor reads. Figma's copy differs per
 * width, so the variants for the other widths are not rendered (display: none)
 * rather than merely clipped. Once a result is on screen the page keeps one
 * h1, named after the product, visually hidden: the result section has its
 * own headline.
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
          "mx-auto mt-4 max-w-[720px] text-display-sm font-bold text-ink md:text-display-md lg:text-display"
        }
      >
        <span className={"md:hidden"}>
          <HeadlineLines lines={startHeadline.compact} />
        </span>
        <span className={"hidden md:inline"}>
          <HeadlineLines lines={startHeadline.regular} />
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
