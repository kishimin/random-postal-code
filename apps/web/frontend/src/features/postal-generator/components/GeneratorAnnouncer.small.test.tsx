import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { announcementTones } from "../announcement-tones";
import { postalGeneratorText } from "../site-text";
import { GeneratorAnnouncer } from "./GeneratorAnnouncer";

describe("GeneratorAnnouncer", () => {
  // The existing medium tests read the region's whole text as the
  // announcement, so the failure's headline must sit beside the region, not
  // inside it -- otherwise it is announced as part of the message.
  test("keeps the live region's text to the announcement alone on a failure", () => {
    render(
      <GeneratorAnnouncer
        announcement={postalGeneratorText.failureAnnouncement.offline}
        tone={announcementTones.error}
      />,
    );

    expect(screen.getByRole("status").textContent?.trim()).toBe(
      postalGeneratorText.failureAnnouncement.offline,
    );
    expect(screen.getByText(postalGeneratorText.failureHeading)).toBeVisible();
  });

  // The panel's title is drawn as a heading, so it has to be one for
  // assistive technology too; the page's h1 stays the hero.
  test("titles a failure with a level-2 heading outside the live region", () => {
    render(
      <GeneratorAnnouncer
        announcement={postalGeneratorText.failureAnnouncement.offline}
        tone={announcementTones.error}
      />,
    );

    const heading = screen.getByRole("heading", {
      level: 2,
      name: postalGeneratorText.failureHeading,
    });
    expect(screen.getByRole("status")).not.toContainElement(heading);
  });

  test("shows no failure headline when nothing failed", () => {
    render(
      <GeneratorAnnouncer
        announcement={postalGeneratorText.loadingAnnouncement}
        tone={announcementTones.loading}
      />,
    );

    expect(
      screen.queryByText(postalGeneratorText.failureHeading),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      postalGeneratorText.loadingAnnouncement,
    );
  });

  // Assistive technology has to be listening before the text arrives
  // (the component's own docstring), so an idle region still exists.
  test("stays mounted and empty before anything has happened", () => {
    render(
      <GeneratorAnnouncer announcement={""} tone={announcementTones.quiet} />,
    );

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
