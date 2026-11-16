import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { describe, expect, test } from "vitest";

/*
 * Acceptance test for Issue #105, criterion 5: the repository holds the Apps
 * Script that posts to Discord on form submission, and the message it builds
 * from a response contains the inquiry type and the form's responses-page
 * link, and contains neither the name nor the content.
 *
 * How the script is run
 * ---------------------
 * The owner pastes the file into the contact form's script editor, where it
 * runs as a classic script: no `module`, no `require`, no `import`, and the
 * Apps Script services as globals. This test runs the committed file the same
 * way, in a fresh `vm` context whose only globals are stand-ins for the two
 * services the script may use (PropertiesService and UrlFetchApp), so a file
 * that only works when Node loads it as a module fails here.
 *
 * The script's location is the one docs/design.md section 3 names for it.
 *
 * What this test deliberately does not pin
 * ----------------------------------------
 * - The message's exact wording. The Issue gives 「新しいお問い合わせ: 不具合の
 *   報告」 as an example, not as fixed copy, so only the type and the link are
 *   required to appear.
 * - That the script is attached to the form, has its trigger, or reaches the
 *   real webhook. The owner does that in Google's editor (Issue #105, Out of
 *   scope), and no test in this repository can observe it.
 *
 * The form ID below is the real contact form's (recorded on Issue #105); it
 * is not a secret, since the responses page it links to requires the owner's
 * sign-in. The webhook URL is a placeholder on a reserved domain.
 */

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const scriptPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  "contact-form",
  "src",
  "notify-discord.cjs",
);

const formId = "1RQuXUKuq9KohMRsG8TeoH_g1ZVjye3LAqfTrssUSFFM";
const responsesPage = `https://docs.google.com/forms/d/${formId}/edit#responses`;
const placeholderWebhook = "https://webhook.example.invalid/zipnami";

const visitorName = "郵便 太郎";
const visitorContent = "〒100-0001 の町域名が古いようです。";
const inquiryTypes = [
  "不具合の報告",
  "住所や郵便番号の誤り",
  "広告について",
  "その他",
];

type Posted = { url: string; params: { payload?: string } };

/**
 * Runs the committed script as Apps Script would, then submits one response.
 * @param inquiryType - The answer to 問い合わせの種類.
 * @returns Every request the script made through UrlFetchApp.
 */
const submitResponse = (inquiryType: string): Posted[] => {
  const posted: Posted[] = [];
  const context = createContext({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          key === "DISCORD_WEBHOOK_URL" ? placeholderWebhook : null,
      }),
    },
    UrlFetchApp: {
      fetch: (url: string, params: { payload?: string }) => {
        posted.push({ url, params });
        return { getResponseCode: () => 204 };
      },
    },
  });
  runInContext(readFileSync(scriptPath, "utf8"), context, {
    filename: scriptPath,
  });

  const answers: [string, string][] = [
    ["お名前（ニックネーム可）", visitorName],
    ["問い合わせの種類", inquiryType],
    ["内容", visitorContent],
  ];
  const event = {
    source: { getId: () => formId },
    response: {
      getItemResponses: () =>
        answers.map(([title, answer]) => ({
          getItem: () => ({ getTitle: () => title }),
          getResponse: () => answer,
        })),
    },
  };
  context.onFormSubmit(event);
  return posted;
};

/**
 * The text a Discord webhook request carries: Discord shows `content`, and
 * any other field (embeds, a username) would be shown or stored as well, so
 * the whole payload is what a visitor's words must stay out of.
 * @param request - One request the script made.
 * @returns The request's JSON body, as sent.
 */
const bodyOf = (request: Posted) => request.params.payload ?? "";

describe("Issue #105: the contact form's Discord notification script", () => {
  test.each(inquiryTypes)(
    "AC-5 a 「%s」 response posts one message naming that type and linking the responses page",
    (inquiryType) => {
      const posted = submitResponse(inquiryType);

      expect(posted).toHaveLength(1);
      const [request] = posted;
      expect(request?.url).toBe(placeholderWebhook);
      const message: unknown = JSON.parse(
        bodyOf(request ?? { url: "", params: {} }),
      );
      expect(message).toMatchObject({
        content: expect.stringContaining(inquiryType),
      });
      expect(message).toMatchObject({
        content: expect.stringContaining(responsesPage),
      });
    },
  );

  test("AC-5 the message contains neither the visitor's name nor the content", () => {
    const [request] = submitResponse("不具合の報告");

    const body = bodyOf(request ?? { url: "", params: {} });
    expect(body).not.toBe("");
    // Parsed and re-serialized, so an answer hidden behind \u escapes in
    // the sent body still shows up verbatim here.
    const decoded = JSON.stringify(JSON.parse(body));
    for (const answer of [visitorName, visitorContent]) {
      expect(body).not.toContain(answer);
      expect(decoded).not.toContain(answer);
    }
  });
});
