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

const send = async (url: string, request: FetchFunction): Promise<Response> => {
  try {
    return await request(url, {
      headers: { Accept: "application/json" },
      // api-design.md section 4.1: repeated generation must never be served
      // from a cache.
      cache: "no-store",
    });
  } catch (error) {
    // fetch rejects only when no response arrived: no connection, DNS, TLS.
    throw new GenerationError("offline", { cause: error });
  }
};

const json = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    throw new GenerationError("invalid-response", { cause: error });
  }
};

/**
 * Calls `GET /api/random` (api-design.md sections 3 and 4) and returns the
 * postal code, or throws a `GenerationError` saying why there is none.
 * @param {string | undefined} apiBaseUrl - The configured API origin.
 * @param {FetchFunction} [request] - The fetch to use.
 */
export const fetchRandomPostalCode = async (
  apiBaseUrl: string | undefined,
  request: FetchFunction = fetch,
): Promise<PostalCode> => {
  const url = randomPostalCodeUrl(apiBaseUrl);
  // A build without a usable API origin cannot generate at all; that is the
  // build's fault, not the person's connection.
  if (url === undefined) throw new GenerationError("unexpected");

  const response = await send(url, request);
  const body = await json(response);
  if (!response.ok) {
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
