/*
 * The two Apps Script services notify-discord.cjs uses, as far as it uses
 * them. Apps Script provides them as globals; the tests stub them.
 */

declare const PropertiesService: {
  getScriptProperties(): { getProperty(key: string): string | null };
};

declare const UrlFetchApp: {
  fetch(
    url: string,
    params: {
      method: "post";
      contentType: string;
      payload: string;
      muteHttpExceptions: boolean;
    },
  ): { getResponseCode(): number };
};
