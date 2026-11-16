/*
 * Zipnami contact form: one Discord message per response (Issue #105).
 *
 * Paste this whole file into the contact form's script editor, set the script
 * property DISCORD_WEBHOOK_URL, and add an installable "On form submit"
 * trigger for onFormSubmit. apps/web/contact-form/README.md has the steps.
 *
 * The message carries only the inquiry type and a link to the form's
 * responses page. The visitor's name and content stay inside Google, which is
 * what lets the privacy page name Google as the only place they go.
 */

/** The question whose answer the message names. Must match the form. */
const INQUIRY_TYPE_QUESTION = "問い合わせの種類";

/**
 * The form's choices for that question. An answer outside them is reported
 * as 不明 rather than posted: it could be the visitor's own words.
 */
const INQUIRY_TYPES = [
  "不具合の報告",
  "住所や郵便番号の誤り",
  "広告について",
  "その他",
];

/**
 * @typedef {object} AnsweredItem
 * @property {string} title - The question, as the form words it.
 * @property {unknown} response - The visitor's answer to it.
 */

/**
 * @typedef {object} DiscordMessage
 * @property {string} content - The text Discord shows.
 * @property {{ parse: string[] }} allowed_mentions - Who the text may ping.
 */

/**
 * Builds the Discord message for one response.
 * @param {readonly AnsweredItem[]} answeredItems - The response's answers.
 * @param {string} formId - The form's ID, for its responses-page link.
 * @returns {DiscordMessage} The webhook request body.
 */
function buildDiscordMessage(answeredItems, formId) {
  const typeItem = answeredItems.find(
    (item) => item.title === INQUIRY_TYPE_QUESTION,
  );
  const answer = typeItem?.response;
  const inquiryType =
    typeof answer === "string" && INQUIRY_TYPES.includes(answer)
      ? answer
      : "不明";
  return {
    content: `新しいお問い合わせ: ${inquiryType}\nhttps://docs.google.com/forms/d/${formId}/edit#responses`,
    // The type is always one of the fixed choices; the guard is there so a
    // later change to the message cannot make it ping the channel.
    allowed_mentions: { parse: [] },
  };
}

/**
 * @typedef {object} FormSubmitEvent
 * The parts of Apps Script's form-submit event the handler reads.
 * @property {{ getId(): string }} source - The form.
 * @property {{ getItemResponses(): { getItem(): { getTitle(): string }, getResponse(): unknown }[] }} response
 *   - The submitted response.
 */

/**
 * The installable "On form submit" trigger's handler.
 * @param {FormSubmitEvent} event - The submission.
 * @returns {void}
 */
function onFormSubmit(event) {
  const webhookUrl = PropertiesService.getScriptProperties().getProperty(
    "DISCORD_WEBHOOK_URL",
  );
  if (!webhookUrl) {
    throw new Error("The script property DISCORD_WEBHOOK_URL is not set.");
  }

  const answeredItems = event.response
    .getItemResponses()
    .map((itemResponse) => ({
      title: itemResponse.getItem().getTitle(),
      response: itemResponse.getResponse(),
    }));

  // Apps Script mails a failed trigger's error to the owner and keeps it in
  // the execution log, so no error leaving this function may carry the
  // webhook URL. muteHttpExceptions turns an HTTP refusal into a status to
  // report; a request that cannot be sent at all (DNS, a malformed URL)
  // still throws, quoting the URL, so that error is replaced, not rethrown.
  const payload = JSON.stringify(
    buildDiscordMessage(answeredItems, event.source.getId()),
  );
  let status;
  try {
    status = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      contentType: "application/json",
      payload,
      muteHttpExceptions: true,
    }).getResponseCode();
  } catch {
    throw new Error(
      "Could not reach Discord. Check the DISCORD_WEBHOOK_URL script property.",
    );
  }
  if (status < 200 || status >= 300) {
    throw new Error(`Discord did not accept the message: HTTP ${status}.`);
  }
}

// Apps Script runs this file as a classic script with no module system, so
// `module` exists only when Node loads the file for its tests.
if (typeof module === "object") {
  module.exports = { buildDiscordMessage, onFormSubmit };
}
