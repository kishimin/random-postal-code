import { afterEach, describe, expect, test, vi } from "vitest";
import notifyDiscord from "./notify-discord.cjs";

const { buildDiscordMessage, onFormSubmit } = notifyDiscord;

const formId = "form-id-for-tests";
const responsesPage = `https://docs.google.com/forms/d/${formId}/edit#responses`;
const webhookUrl = "https://webhook.example.invalid/zipnami";
const visitorName = "郵便 太郎";
const visitorContent = "町域名が古いようです。";

const answeredItems = [
  { title: "お名前（ニックネーム可）", response: visitorName },
  { title: "問い合わせの種類", response: "住所や郵便番号の誤り" },
  { title: "内容", response: visitorContent },
];

describe("buildDiscordMessage", () => {
  test("names the inquiry type and links the form's responses page", () => {
    expect(buildDiscordMessage(answeredItems, formId).content).toBe(
      `新しいお問い合わせ: 住所や郵便番号の誤り\n${responsesPage}`,
    );
  });

  test("carries neither the name nor the content", () => {
    const sent = JSON.stringify(buildDiscordMessage(answeredItems, formId));

    expect(sent).not.toContain(visitorName);
    expect(sent).not.toContain(visitorContent);
  });

  test("lets nothing in the message ping anyone", () => {
    expect(buildDiscordMessage(answeredItems, formId).allowed_mentions).toEqual(
      { parse: [] },
    );
  });

  test("says the type is unknown when the response has no text answer to it", () => {
    const withoutType = answeredItems.filter(
      (item) => item.title !== "問い合わせの種類",
    );

    expect(buildDiscordMessage(withoutType, formId).content).toBe(
      `新しいお問い合わせ: 不明\n${responsesPage}`,
    );
    expect(
      buildDiscordMessage(
        [{ title: "問い合わせの種類", response: ["不具合の報告"] }],
        formId,
      ).content,
    ).toBe(`新しいお問い合わせ: 不明\n${responsesPage}`);
  });
});

describe("onFormSubmit", () => {
  const submission = {
    source: { getId: () => formId },
    response: {
      getItemResponses: () =>
        answeredItems.map((item) => ({
          getItem: () => ({ getTitle: () => item.title }),
          getResponse: () => item.response,
        })),
    },
  };

  /**
   * Stands in for the two Apps Script services the handler uses.
   * @param options - What the services answer.
   * @param options.webhook - The DISCORD_WEBHOOK_URL script property.
   * @param options.status - The HTTP status Discord answers with.
   * @returns The fetch stand-in, to inspect what was sent.
   */
  const stubAppsScript = (options: {
    webhook: string | null;
    status: number;
  }) => {
    const fetch = vi.fn(() => ({ getResponseCode: () => options.status }));
    vi.stubGlobal("PropertiesService", {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          key === "DISCORD_WEBHOOK_URL" ? options.webhook : null,
      }),
    });
    vi.stubGlobal("UrlFetchApp", { fetch });
    return fetch;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts the message as JSON to the webhook in the script property", () => {
    const fetch = stubAppsScript({ webhook: webhookUrl, status: 204 });

    onFormSubmit(submission);

    expect(fetch).toHaveBeenCalledExactlyOnceWith(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(buildDiscordMessage(answeredItems, formId)),
      muteHttpExceptions: true,
    });
  });

  test("posts nothing and says so when the webhook property is not set", () => {
    const fetch = stubAppsScript({ webhook: null, status: 204 });

    expect(() => {
      onFormSubmit(submission);
    }).toThrow("DISCORD_WEBHOOK_URL");
    expect(fetch).not.toHaveBeenCalled();
  });

  test("fails naming only the status when Discord refuses the message", () => {
    stubAppsScript({ webhook: webhookUrl, status: 404 });

    expect(() => {
      onFormSubmit(submission);
    }).toThrow("HTTP 404");
    expect(() => {
      onFormSubmit(submission);
    }).not.toThrow(webhookUrl);
  });
});
