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
  const inquiryType =
    typeof typeItem?.response === "string" ? typeItem.response : "不明";
  return {
    content: `新しいお問い合わせ: ${inquiryType}\nhttps://docs.google.com/forms/d/${formId}/edit#responses`,
    // The type is one of the form's fixed choices, but the guard keeps a
    // response from ever pinging the channel whatever it holds.
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

  // muteHttpExceptions: UrlFetchApp's own error names the request, and Apps
  // Script mails a failed trigger's error to the owner; the error below names
  // only the status, so the webhook URL never leaves the script property.
  const reply = UrlFetchApp.fetch(webhookUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(
      buildDiscordMessage(answeredItems, event.source.getId()),
    ),
    muteHttpExceptions: true,
  });
  const status = reply.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Discord did not accept the message: HTTP ${status}.`);
  }
}

// Apps Script runs this file as a classic script with no module system, so
// `module` exists only when Node loads the file for its tests.
if (typeof module === "object") {
  module.exports = { buildDiscordMessage, onFormSubmit };
}
