import {
  apiErrorResponseSchema,
  postalCodeSchema,
  type ApiErrorCode,
  type PostalCode,
} from "@zipnami/shared";

export type ApiClient = {
  resolveUrl: (path: string) => string;
};

const RANDOM_POSTAL_CODE_PATH = "api/random";

/**
 * The JSON error envelope api-design.md section 4.2 defines, thrown by
 * `fetchRandomPostalCode` for any non-2xx response.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId: string;

  /**
   * @param message - The envelope's safe, non-sensitive message.
   * @param status - The HTTP status the response carried.
   * @param code - The envelope's error code.
   * @param requestId - The envelope's request id, echoed in `X-Request-Id`.
   */
  constructor(
    message: string,
    status: number,
    code: ApiErrorCode,
    requestId: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * Configures how the client addresses the Zipnami API.
 *
 * The base URL is passed in rather than read from the environment here, because
 * this module sits in the shared layer and validating the build's environment
 * belongs to the application layer. Keeping the dependency in that direction is
 * what lets a test configure a client without a build.
 *
 * `baseUrl` is an absolute origin that may carry a path prefix.
 */
export const createApiClient = (baseUrl: string): ApiClient => {
  // A base without a trailing slash makes new URL() treat its last segment as a
  // file and drop it, so a Worker published under a sub-path would lose the
  // prefix. The slash is appended to the path rather than to the whole string,
  // because a base carrying a query or a fragment would otherwise get it in the
  // wrong place and lose the prefix anyway. Neither belongs in a base URL, so
  // they are discarded rather than carried into every request.
  const { origin, pathname } = new URL(baseUrl);
  const base = new URL(
    pathname.endsWith("/") ? pathname : `${pathname}/`,
    origin,
  );

  // Every leading slash, not just the first: `//api/random` is a
  // protocol-relative reference that would otherwise resolve against the host
  // and drop the prefix along with it.
  const resolveUrl = (path: string) =>
    new URL(path.replace(/^\/+/, ""), base).toString();

  return { resolveUrl };
};

/**
 * Calls `GET /api/random` and returns the postal code it carries.
 *
 * Throws `ApiRequestError` for the JSON error envelope api-design.md section
 * 4.2 defines. A network failure or a success body that fails
 * `postalCodeSchema` propagates as whatever `fetch` or zod raised instead of
 * being wrapped, so the caller can tell the two apart (design.md section 4's
 * `UiError` distinguishes "offline" from "invalid-response").
 */
export const fetchRandomPostalCode = async (
  client: ApiClient,
): Promise<PostalCode> => {
  const response = await fetch(client.resolveUrl(RANDOM_POSTAL_CODE_PATH), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body: unknown = await response.json();
    const { error } = apiErrorResponseSchema.parse(body);
    throw new ApiRequestError(
      error.message,
      response.status,
      error.code,
      error.requestId,
    );
  }

  const body: unknown = await response.json();
  return postalCodeSchema.parse(body);
};
