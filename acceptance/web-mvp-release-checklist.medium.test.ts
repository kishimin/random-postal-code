import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #21, criterion "Representative mobile, tablet,
 * desktop, accessibility, offline, and production-build Web checks are
 * recorded", and the two criteria Issue #21 answer B leaves for after
 * deployment (Issue #19).
 *
 * Why this is a separate, Medium file
 * -----------------------------------
 * The checks themselves are browser journeys on a local stack and live in
 * web-mvp-end-to-end.large.test.ts. "Recorded" is a different claim: that a
 * release has a written, reproducible record of which checks were run and
 * which are still owed. Issue #21 answer B puts that record at
 * docs/release-checklist.md. Reading a committed file needs no browser and
 * no server, so this runs under `bun test` from the repository root, like
 * the Issue #18 tests that also read repository files rather than drive a
 * package (ADR-0077). It touches the file system, which is what makes it
 * Medium rather than Small (ADR-0004).
 *
 * What is asserted, and what is deliberately not
 * ----------------------------------------------
 * - Each category the criterion names has at least one check marked done
 *   ("- [x]"), found either in the item itself or under a heading naming
 *   the category. The wording, order, and heading levels are the
 *   document's to choose.
 * - The record points at the automated check that reproduces it, so the
 *   next release can rerun it rather than repeat it by hand.
 * - The two deployment-dependent criteria are present and still open
 *   ("- [ ]"), each naming Issue #19. A record that ticked them before the
 *   site is deployed would claim something nothing has checked.
 * - Whether the ticked checks really passed is not asserted here; that is
 *   what the Large file proves each time it runs. This file holds that the
 *   record exists and does not overclaim.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const checklistPath = path.join(repositoryRoot, "docs", "release-checklist.md");

// The automated check the record has to name, so a release can rerun it.
const reproducingTest = "acceptance/web-mvp-end-to-end.large.test.ts";

/*
 * The categories the criterion names, each with the words a checklist
 * written in English or Japanese would use for it.
 */
const categories: readonly { name: string; pattern: RegExp }[] = [
  { name: "mobile", pattern: /mobile|phone|モバイル|スマートフォン/i },
  { name: "tablet", pattern: /tablet|タブレット/i },
  { name: "desktop", pattern: /desktop|デスクトップ/i },
  {
    name: "accessibility",
    pattern: /accessibility|a11y|axe|WCAG|アクセシビリティ/i,
  },
  { name: "offline", pattern: /offline|オフライン/i },
  { name: "production build", pattern: /production[- ]build|本番ビルド/i },
];

type ChecklistItem = {
  readonly checked: boolean;
  readonly text: string;
  /** Every heading the item sits under, outermost first. */
  readonly headings: readonly string[];
};

/**
 * The Markdown task-list items of a document, each with the headings above it.
 *
 * An item's text includes its continuation lines, not only its first line
 * (Issue #82): a claim wrapped onto a second line is still part of the item
 * that ticks it. A continuation is any following line that is not blank, not
 * a heading, and not the start of another list item, which covers both
 * indented and lazy continuations. A blank line ends the item.
 * @param markdown - The document text.
 */
const checklistItems = (markdown: string): ChecklistItem[] => {
  const items: { checked: boolean; text: string; headings: string[] }[] = [];
  const headingTrail: string[] = [];
  let current: (typeof items)[number] | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      const [, hashes = "#", title = ""] = heading;
      headingTrail.length = hashes.length - 1;
      headingTrail.push(title);
      current = undefined;
      continue;
    }

    const item = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (item !== null) {
      const [, mark = " ", text = ""] = item;
      current = {
        checked: mark !== " ",
        text,
        headings: headingTrail.filter((entry) => entry !== undefined),
      };
      items.push(current);
      continue;
    }

    if (line.trim() === "" || /^\s*[-*+]\s/.test(line)) {
      current = undefined;
      continue;
    }

    if (current !== undefined) {
      current.text = `${current.text} ${line.trim()}`;
    }
  }

  return items;
};

/*
 * A claim only the deployed site can confirm: it names one of the
 * deployment-dependent checks and says it holds publicly or once deployed.
 * Matched without regard to whether the item mentions Issue #19, so a ticked
 * claim that drops the reference is still caught (Issue #82). "本番" alone is
 * not enough: 本番ビルド, the production build, is checked locally.
 */
const deploymentOnlySubject = /\/privacy|Japan Post|日本郵便|SDK/i;
const deploymentOnlyQualifier =
  /deployed|deployment|publicly|public\b|公開|デプロイ/i;

const isDeploymentOnlyClaim = (item: ChecklistItem) =>
  deploymentOnlySubject.test(item.text) &&
  deploymentOnlyQualifier.test(item.text);

const readChecklist = () => readFileSync(checklistPath, "utf8");

describe("Issue #21: the Web MVP release checks are recorded", () => {
  test("docs/release-checklist.md exists", () => {
    expect({
      path: "docs/release-checklist.md",
      exists: existsSync(checklistPath),
    }).toEqual({
      path: "docs/release-checklist.md",
      exists: true,
    });
  });

  test("every representative category has at least one check recorded as done", () => {
    const items = checklistItems(readChecklist());

    for (const category of categories) {
      const done = items.some(
        (item) =>
          item.checked &&
          (category.pattern.test(item.text) ||
            item.headings.some((heading) => category.pattern.test(heading))),
      );
      expect({ category: category.name, recordedAsDone: done }).toEqual({
        category: category.name,
        recordedAsDone: true,
      });
    }
  });

  test("the record names the automated check that reproduces it", () => {
    expect(readChecklist()).toContain(reproducingTest);
  });

  test("the deployment-dependent checks are listed and still open, pending Issue #19", () => {
    const pendingOnDeployment = checklistItems(readChecklist()).filter((item) =>
      /#19\b/.test(item.text),
    );

    // Issue #21 answer B: /privacy and the Japan Post attribution being
    // publicly reachable, and the deployed Web SDKs matching the disclosure.
    const owed: readonly { name: string; pattern: RegExp }[] = [
      { name: "/privacy publicly accessible", pattern: /\/privacy/ },
      { name: "Japan Post attribution", pattern: /Japan Post|日本郵便/i },
      { name: "deployed Web SDKs match", pattern: /SDK/i },
    ];

    for (const { name, pattern } of owed) {
      const listed = pendingOnDeployment.filter((item) =>
        pattern.test(item.text),
      );
      expect({ check: name, listed: listed.length > 0 }).toEqual({
        check: name,
        listed: true,
      });
      // Not ticked: nothing can have checked a site that is not deployed.
      expect({
        check: name,
        ticked: listed.some((item) => item.checked),
      }).toEqual({
        check: name,
        ticked: false,
      });
    }
  });

  test("no deployment-only claim is ticked, whether or not it mentions Issue #19", () => {
    const tickedClaims = checklistItems(readChecklist())
      .filter((item) => item.checked && isDeploymentOnlyClaim(item))
      .map((item) => item.text);

    // Nothing can have checked a site that is not deployed yet.
    expect(tickedClaims).toEqual([]);
  });
});
