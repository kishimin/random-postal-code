import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

/*
 * Acceptance test for Issue #25: Record the Figma UI source and its screen map.
 *
 * Each test name states the acceptance criterion it holds, so a failure names
 * the criterion that broke rather than only the assertion.
 *
 * What is observable for an Issue about a document
 * ------------------------------------------------
 * This Issue delivers no screen and no API. Its Out of scope section says so:
 * "Implementing the screens. This issue records the source; behaviour is
 * tracked by the issues that own each screen." What it delivers is the ability
 * of a reader of `docs/ui-design.md` to answer three questions without opening
 * Figma: which Figma file is the visual source, which screen a node id belongs
 * to, and which issue owns that screen. So what this test observes is the
 * committed document, read as text, exactly as a contributor reads it.
 *
 * Why this acceptance test has no browser, and runs under `bun test`
 * -----------------------------------------------------------------
 * It drives no browser, so Playwright is not its runner (ADR-0069), and it
 * exercises no workspace package, so no package's `vitest.config.ts` has a
 * claim on it either — the subject is a repository document. ADR-0077 answers
 * exactly this case: such a test is bound to its runner by a CI workflow step
 * that names its path, `bun test ./acceptance/figma-ui-source-and-screen-map
 * .medium.test.ts`, rather than by a `testMatch` or `include` entry. It stays
 * in `acceptance/` because ADR-0062 makes that directory the location that
 * identifies and protects an acceptance test, independently of how it runs.
 *
 * Why this is Medium
 * ------------------
 * It reads the file system. It uses no network, no browser, no external
 * service, and spawns no process (ADR-0004, ADR-0044). Medium is also the size
 * whose schedule matches this gate: Small and Medium run on every pull request
 * (ADR-0034, ADR-0043), which is where a drifting screen map has to be caught.
 *
 * One line per screen
 * -------------------
 * The map's shape is the implementation's choice — a table, a list, anything a
 * reader can scan — with one constraint this test does impose: each screen's
 * entry sits on a single line, together with its node id, its owner, and any
 * V2 or gap marking. A node id three paragraphs away from the screen name
 * records nothing a reader can act on, and a test that accepted it could not
 * tell a correct map from a shuffled one.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - The specific colour, type, and copy values. The criterion asks that the
 *   values the screens fix "are recorded in the visual and content contract,
 *   or the contract states why a value is deliberately not fixed"; it names the
 *   three categories and no individual token. Figma is the source for the
 *   values themselves, so hard-coding a hex code here would move that source
 *   into this file and force the document to agree with this test rather than
 *   with the design. What is held is that each of the three categories is
 *   answered in that section — with a value, or with a stated reason for not
 *   fixing one.
 * - Which screens are the open gaps. The criterion is conditional ("A screen
 *   present in Figma but not covered by any issue is listed as an open gap"),
 *   so the invariant, not a list, is what holds: every mapped screen is either
 *   attributed to an issue or marked as a gap. The Issue's Notes section says
 *   screens 13 to 16 are the uncovered ones, and that claim is already stale —
 *   `acceptance/error-destinations.medium.test.ts` (Issue #26, closed) covers
 *   the 404 and global error screens, nodes `27:100` through `27:131`. Pinning
 *   13 to 16 as the gap would require the document to repeat a fact that is no
 *   longer true. The invariant instead forces whoever writes the map to answer
 *   for each screen with what is true when they write it.
 * - Whether an issue number cited as an owner really covers that screen. That
 *   needs GitHub, and the network makes a test Large; this criterion asks for
 *   the attribution to be present and auditable, not for the attribution to be
 *   proven here.
 * - Pixel-level visual regression baselines, the Issue's other Out of scope
 *   item, are not exercised.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const uiDesignPath = path.join(repositoryRoot, "docs", "ui-design.md");

const document = readFileSync(uiDesignPath, "utf8");
const lines = document.split(/\r?\n/);
const paragraphs = document
  .split(/\r?\n[ \t]*\r?\n/)
  .map((paragraph) => paragraph.replaceAll(/\s+/g, " ").trim())
  .filter((paragraph) => paragraph.length > 0);

/** The Figma file named in the Issue as the visual source. */
const figmaFileKey = "40UjUstDqllFYEaQ31J8L0";

/**
 * The Issue's screen map, verbatim. `mentions` are the words that distinguish
 * this screen from the other fifteen; they are matched case-insensitively, so
 * the document is free to write the label its own way.
 */
const screens = [
  { label: "01 Web / Desktop / Start", node: "11:2", platform: "web" },
  { label: "02 Web / Desktop / Result", node: "11:3", platform: "web" },
  { label: "03 Web / Tablet / Start", node: "11:4", platform: "web" },
  { label: "04 Web / Tablet / Result", node: "11:5", platform: "web" },
  { label: "05 Web / Mobile / Start", node: "11:6", platform: "web" },
  { label: "06 Web / Mobile / Result", node: "11:7", platform: "web" },
  { label: "07 Android / Start", node: "11:8", platform: "android" },
  { label: "08 Android / Result", node: "11:9", platform: "android" },
  { label: "09 Web / Desktop / Field Error", node: "27:33", platform: "web" },
  { label: "10 Web / Mobile / Field Error", node: "27:56", platform: "web" },
  { label: "11 Web / Desktop / API Error", node: "27:72", platform: "web" },
  { label: "12 Web / Mobile / API Error", node: "27:93", platform: "web" },
  { label: "13 404 / Desktop", node: "27:100", platform: "web" },
  { label: "14 404 / Mobile", node: "27:112", platform: "web" },
  { label: "15 Global Error / Desktop", node: "27:123", platform: "web" },
  { label: "16 Global Error / Mobile", node: "27:131", platform: "web" },
].map((screen) => ({
  ...screen,
  // "01 Web / Desktop / Start" -> ["web", "desktop", "start"]; the leading
  // number is the Issue's row number, not part of the screen's name.
  mentions: screen.label
    .replace(/^\d+\s+/, "")
    .split("/")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0),
}));

/**
 * Lines that carry this node id. The lookaround keeps `11:2` from matching
 * inside a longer id, so a map that mistypes one node cannot be rescued by
 * another node's row.
 */
const linesWithNode = (node: string): string[] => {
  const pattern = new RegExp(`(?<![\\d:])${node}(?![\\d])`);
  return lines.filter((line) => pattern.test(line));
};

/** The screen's own entry: the line that carries both its node id and name. */
const entryLines = (screen: (typeof screens)[number]): string[] =>
  linesWithNode(screen.node).filter((line) => {
    const haystack = line.toLowerCase();
    return screen.mentions.every((mention) => haystack.includes(mention));
  });

/**
 * The body of the section that holds the visual and content contract, located
 * by its heading rather than by its number so renumbering the file does not
 * break this test.
 */
const visualAndContentContract = (): string[] => {
  const headingPattern = /^#{1,6}\s/;
  const start = lines.findIndex(
    (line) =>
      headingPattern.test(line) &&
      /visual/i.test(line) &&
      /content/i.test(line),
  );
  if (start === -1) return [];
  const depth = (/^#+/.exec(lines[start]) ?? [""])[0].length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(
    (line) =>
      headingPattern.test(line) &&
      (/^#+/.exec(line) ?? [""])[0].length <= depth,
  );
  return end === -1 ? rest : rest.slice(0, end);
};

// Six or eight digits, not three: `#123` is also how an issue is referenced,
// and an owner column must not be mistaken for a recorded colour.
const hexColour = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/;
const colourFunction = /\b(?:rgba?|hsla?|oklch|lab|color-mix)\(/;
const typeSubject =
  /font|typeface|typograph|type\s*scale|weight|letter-spacing/i;
const typeValue =
  /\b\d+(?:\.\d+)?(?:px|rem|em|pt)\b|\b[1-9]00\b|`[^`\n]+`|"[^"\n]+"/;
// A display string the screens fix, quoted so a reader can see it is a literal:
// the UI language is Japanese (section 2), and the wordmark is the one fixed
// string that is not.
const japanese = /[぀-ヿ㐀-䶿一-鿿＀-￯]/;
const quotedLiteral = /`([^`\n]+)`|"([^"\n]+)"|“([^”\n]+)”/g;

/**
 * A value this category deliberately does not fix, with the reason stated. One
 * paragraph has to carry the category, the decision, and the reason together:
 * a reason given for one category is not a reason for another.
 */
const notFixedOnPurpose = (
  contractParagraphs: string[],
  subject: RegExp,
): boolean =>
  contractParagraphs.some(
    (paragraph) =>
      subject.test(paragraph) &&
      /not\s+fixed|left\s+unfixed|deliberately\s+open/i.test(paragraph) &&
      /because|since|so that|reason/i.test(paragraph),
  );

describe("Issue #25: the Figma UI source and its screen map", () => {
  test("the visual source is recorded: docs/ui-design.md names the Figma file by its file key", () => {
    expect({
      document: "docs/ui-design.md",
      namesFigma: /figma/i.test(document),
      recordsFileKey: document.includes(figmaFileKey),
    }).toEqual({
      document: "docs/ui-design.md",
      namesFigma: true,
      recordsFileKey: true,
    });
  });

  test("every screen appears in the screen-to-node map with its node id", () => {
    for (const screen of screens) {
      expect({
        screen: screen.label,
        node: screen.node,
        nodeIdRecorded: linesWithNode(screen.node).length > 0,
        mappedToThisScreen: entryLines(screen).length > 0,
      }).toEqual({
        screen: screen.label,
        node: screen.node,
        nodeIdRecorded: true,
        mappedToThisScreen: true,
      });
    }
  });

  test("the visual and content contract answers for colour, type, and copy: a value, or why it is deliberately not fixed", () => {
    const contract = visualAndContentContract();
    expect({ visualAndContentContractSection: contract.length > 0 }).toEqual({
      visualAndContentContractSection: true,
    });

    const contractParagraphs = contract
      .join("\n")
      .split(/\n[ \t]*\n/)
      .map((paragraph) => paragraph.replaceAll(/\s+/g, " ").trim())
      .filter((paragraph) => paragraph.length > 0);

    const colourRecorded = contract.some(
      (line) => hexColour.test(line) || colourFunction.test(line),
    );
    const typeRecorded = contract.some(
      (line) => typeSubject.test(line) && typeValue.test(line),
    );
    const copyRecorded = contract.some((line) =>
      [...line.matchAll(quotedLiteral)].some((match) =>
        japanese.test(match[1] ?? match[2] ?? match[3] ?? ""),
      ),
    );

    const answered: [string, boolean, RegExp][] = [
      ["colour", colourRecorded, /colou?r|palette|surface|background/i],
      ["type", typeRecorded, typeSubject],
      ["copy", copyRecorded, /copy|wording|string|label|text/i],
    ];
    for (const [category, recorded, subject] of answered) {
      expect({
        category,
        recordedOrExplained:
          recorded || notFixedOnPurpose(contractParagraphs, subject),
      }).toEqual({ category, recordedOrExplained: true });
    }
  });

  test("the Android screens are marked V2 in the map and excluded from Web MVP requirements", () => {
    for (const screen of screens.filter(
      (candidate) => candidate.platform === "android",
    )) {
      expect({
        screen: screen.label,
        node: screen.node,
        markedV2: entryLines(screen).some((line) => /\bV2\b/.test(line)),
      }).toEqual({
        screen: screen.label,
        node: screen.node,
        markedV2: true,
      });
    }

    expect({
      androidExcludedFromWebMvp: paragraphs.some(
        (paragraph) =>
          /android/i.test(paragraph) &&
          /\bnot\b|exclude/i.test(paragraph) &&
          /web\s+mvp/i.test(paragraph),
      ),
    }).toEqual({ androidExcludedFromWebMvp: true });
  });

  test("no screen is silently omitted: each one names the issue that owns it, or is listed as an open gap", () => {
    for (const screen of screens) {
      const owned = entryLines(screen).some(
        (line) =>
          /#\d+/.test(line) ||
          /gap|not covered|uncovered|no issue/i.test(line) ||
          (screen.platform === "android" && /\bV2\b/.test(line)),
      );
      expect({
        screen: screen.label,
        node: screen.node,
        attributedToAnIssueOrListedAsAGap: owned,
      }).toEqual({
        screen: screen.label,
        node: screen.node,
        attributedToAnIssueOrListedAsAGap: true,
      });
    }
  });
});
