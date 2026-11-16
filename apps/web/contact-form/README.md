# Zipnami contact form notifier

The Google Apps Script that posts one Discord message for each response to the Zipnami contact form (Issue #105). The message holds only the inquiry type and a link to the form's responses page, for example:

```text
新しいお問い合わせ: 不具合の報告
https://docs.google.com/forms/d/<form ID>/edit#responses
```

The visitor's name and content never leave Google.

The script is not deployed by CI. The owner attaches it to the form once, in Google's editor, because the OAuth scopes the repository's tooling holds cannot attach a script to a form.

## Attach the script (owner, once)

1. Open the contact form in Google Forms, then ︙ → スクリプト エディタ.
2. Replace the editor's `Code.gs` with the whole of [`src/notify-discord.cjs`](src/notify-discord.cjs) and save.
3. Project settings (⚙) → スクリプト プロパティ → add `DISCORD_WEBHOOK_URL` with the Discord webhook URL. The URL is a secret: it belongs only in this property, never in the repository, an Issue, or a PR.
4. Triggers (⏰) → トリガーを追加 → function `onFormSubmit`, event source フォームから, event type フォーム送信時. Save and grant the permissions Google asks for.
5. Send one test response. Discord should receive one message with the type and the link, and nothing of the name or the content.

If the webhook property is missing or Discord refuses the message, the trigger fails, and Apps Script mails the failure to the owner. The error names only the HTTP status, never the webhook URL.

## Develop

| Command                                                  | What it does                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `bun run --filter @zipnami/web-contact-form test:small`  | The script's Small tests                                                 |
| `bun run --filter @zipnami/web-contact-form test:medium` | The Issue #105 acceptance test, which runs the file as Apps Script would |
| `bun run --filter @zipnami/web-contact-form typecheck`   | Type-checks the script through its JSDoc                                 |

`src/notify-discord.cjs` stays a classic script: no `import`, no `export`, and Apps Script's services as globals (`src/apps-script.d.ts` types the two it uses). It hands its functions to Node only when a `module` object exists, which Apps Script never has.
