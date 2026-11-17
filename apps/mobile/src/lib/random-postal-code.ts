import {
  apiErrorResponseSchema,
  postalCodeSchema,
  type PostalCode,
} from "@zipnami/shared";

/**
 * Why a generation failed, in the terms the screen explains to a person
 * (the same kinds as the Web client's, ui-design.md section 4).
 */
export type GenerationFailure =
  "offline" | "service-unavailable" | "invalid-response" | "unexpected";

/** A failure `fetchRandomPostalCode` has already classified. */
export class GenerationError extends Error {
  readonly failure: GenerationFailure;

  /**
   * @param {GenerationFailure} failure - What went wrong.
   * @param {{ cause?: unknown }} [options] - The error that caused it.
   * @param {unknown} [options.cause] - That error.
   */
  constructor(failure: GenerationFailure, options?: { cause?: unknown }) {
    super(`postal-code generation failed: ${failure}`, options);
    this.name = "GenerationError";
    this.failure = failure;
  }
}

/**
 * How long a generation may take before it counts as offline. React
 * Native's Android networking (OkHttp) sets no connect or read timeout, so
 * without this a stalled connection would keep the action busy forever.
 */
export const GENERATION_TIMEOUT_MS = 10_000;

/**
 * The URL of `GET /api/random` under an API origin that may carry a path
 * prefix, or undefined when no origin is configured or it is not HTTPS.
 * The app only talks to the API over HTTPS: Android blocks cleartext by
 * default and iOS's App Transport Security does the same.
 */
export const randomPostalCodeUrl = (
  apiBaseUrl: string | undefined,
): string | undefined => {
  // Matched as text rather than through new URL(): React Native's URL is
  // not the WHATWG one, and its getters such as `protocol` and `pathname`
  // are not implemented on every version. Jest runs Node's URL, so a test
  // would pass while the device threw.
  if (apiBaseUrl === undefined) return undefined;
  if (!/^https:\/\/[^/?#\s]+(\/[^?#\s]*)?$/.test(apiBaseUrl)) return undefined;
  return `${apiBaseUrl.replace(/\/+$/, "")}/api/random`;
};

/** The fetch a request goes through; the global one in the app. */
export type FetchFunction = typeof fetch;

type Answer = { readonly ok: boolean; readonly body: unknown };

const responseOf = async (
  url: string,
  request: FetchFunction,
  signal: AbortSignal,
): Promise<Response> => {
  try {
    // No `cache: "no-store"`, unlike the Web client: React Native's fetch
    // is whatwg-fetch, which turns that option into a `?_=<time>` query on
    // a GET, and the API rejects every query parameter with 400
    // (api-design.md section 4.1). The API's own Cache-Control: no-store
    // already keeps the native HTTP stacks from caching the answer.
    return await request(url, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    // fetch rejects only when no response arrived: no connection, DNS,
    // TLS, or the time limit aborting it.
    throw new GenerationError("offline", { cause: error });
  }
};

const answerOf = async (
  url: string,
  request: FetchFunction,
  signal: AbortSignal,
): Promise<Answer> => {
  const response = await responseOf(url, request, signal);
  try {
    return { ok: response.ok, body: (await response.json()) as unknown };
  } catch (error) {
    // React Native's fetch reads the whole body before it resolves, so a
    // body that fails here arrived but is not JSON.
    throw new GenerationError("invalid-response", { cause: error });
  }
};

/**
 * Calls `GET /api/random` (api-design.md sections 3 and 4) and returns the
 * postal code, or throws a `GenerationError` saying why there is none.
 * @param {string | undefined} apiBaseUrl - The configured API origin.
 * @param {FetchFunction} [request] - The fetch to use.
 * @param {{ timeoutMs?: number }} [options] - Limits for the request.
 * @param {number} [options.timeoutMs] - When to give up and report offline.
 */
export const fetchRandomPostalCode = async (
  apiBaseUrl: string | undefined,
  request: FetchFunction = fetch,
  { timeoutMs = GENERATION_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<PostalCode> => {
  const url = randomPostalCodeUrl(apiBaseUrl);
  // A build without a usable API origin cannot generate at all; that is the
  // build's fault, not the person's connection.
  if (url === undefined) throw new GenerationError("unexpected");

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  const { ok, body } = await answerOf(url, request, controller.signal).finally(
    () => {
      clearTimeout(timer);
    },
  );

  if (!ok) {
    const envelope = apiErrorResponseSchema.safeParse(body);
    if (!envelope.success) {
      throw new GenerationError("invalid-response", { cause: envelope.error });
    }
    throw new GenerationError(
      envelope.data.error.code === "DATA_UNAVAILABLE"
        ? "service-unavailable"
        : "unexpected",
    );
  }

  const parsed = postalCodeSchema.safeParse(body);
  if (!parsed.success) {
    throw new GenerationError("invalid-response", { cause: parsed.error });
  }
  return parsed.data;
};

/**
 * The failure behind any rejection, so a caller never has to guess.
 * @param {unknown} error - What a generation rejected with.
 */
export const failureOf = (error: unknown): GenerationFailure =>
  error instanceof GenerationError ? error.failure : "unexpected";
