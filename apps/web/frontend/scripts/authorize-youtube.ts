/*
 * Gets the refresh token upload:demo sends with (Issue #132, step 5). Run it
 * once, by hand, in your own terminal:
 *
 *   bun run authorize:youtube
 *
 * Needs ZIPNAMI_YOUTUBE_CLIENT_ID and ZIPNAMI_YOUTUBE_CLIENT_SECRET from a
 * Desktop OAuth client. It prints a Google consent URL, waits on a loopback
 * address for Google to send the code back, and prints the refresh token for
 * you to store as ZIPNAMI_YOUTUBE_REFRESH_TOKEN.
 *
 * The token is printed rather than written to a file in the repository, so it
 * can never be committed. Do not paste it into an Issue, a PR, or a chat.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  authorizationUrl,
  CREDENTIAL_VARIABLES,
  redactSecrets,
  TOKEN_URL,
} from "./demo-video-upload.ts";

const clientId = process.env[CREDENTIAL_VARIABLES.clientId] ?? "";
const clientSecret = process.env[CREDENTIAL_VARIABLES.clientSecret] ?? "";

if (clientId === "" || clientSecret === "") {
  console.error(
    `Set ${CREDENTIAL_VARIABLES.clientId} and ${CREDENTIAL_VARIABLES.clientSecret} first.`,
  );
  process.exit(1);
}

const state = randomUUID();
const codeVerifier = randomBytes(48).toString("base64url");
const codeChallenge = createHash("sha256")
  .update(codeVerifier)
  .digest("base64url");

const exchange = async (code: string, redirectUri: string): Promise<string> => {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `The code exchange failed with HTTP ${String(response.status)}: ${redactSecrets(text, [clientSecret])}`,
    );
  }
  const { refresh_token: refreshToken } = JSON.parse(text) as {
    refresh_token?: string;
  };
  if (refreshToken === undefined) {
    throw new Error("Google returned no refresh token.");
  }

  return refreshToken;
};

const server = createServer((request, response) => {
  const { port } = server.address() as AddressInfo;
  const redirectUri = `http://127.0.0.1:${String(port)}`;
  const query = new URL(request.url ?? "/", redirectUri).searchParams;

  // A request without our state is not Google's answer to our consent page.
  if (query.get("state") !== state) {
    response.writeHead(400).end();
    return;
  }

  const finish = (status: number, message: string) => {
    response
      .writeHead(status, { "Content-Type": "text/plain; charset=utf-8" })
      .end(message);
    server.close();
  };

  const code = query.get("code");
  if (code === null) {
    finish(400, "許可されませんでした。ターミナルを確認してください。");
    console.error(
      `Authorization was not granted: ${query.get("error") ?? "unknown"}`,
    );
    process.exitCode = 1;
    return;
  }

  exchange(code, redirectUri)
    .then((refreshToken) => {
      finish(200, "完了しました。このタブは閉じてかまいません。");
      console.error(
        `\nStore this as ${CREDENTIAL_VARIABLES.refreshToken} (only in your own settings, never in Git, an Issue, a PR, or a chat):\n`,
      );
      console.log(refreshToken);
    })
    .catch((error: unknown) => {
      finish(500, "失敗しました。ターミナルを確認してください。");
      console.error(
        redactSecrets(error instanceof Error ? error.message : String(error), [
          clientSecret,
        ]),
      );
      process.exitCode = 1;
    });
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address() as AddressInfo;
  console.error(
    `Open this page, sign in with the channel's Google account, and allow the upload:\n\n${authorizationUrl(
      {
        clientId,
        redirectUri: `http://127.0.0.1:${String(port)}`,
        state,
        codeChallenge,
      },
    )}\n`,
  );
});
