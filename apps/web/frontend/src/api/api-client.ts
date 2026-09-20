export type ApiClient = {
  resolveUrl: (path: string) => string;
};

/**
 * Configures how the client addresses the Zipnami API.
 *
 * The base URL is passed in rather than read from the environment here, because
 * this module sits in the shared layer and validating the build's environment
 * belongs to the application layer. Keeping the dependency in that direction is
 * what lets a test configure a client without a build.
 *
 * Endpoints are not defined here. `GET /api/random` arrives with Issue #6.
 *
 * `baseUrl` is an absolute origin that may carry a path prefix.
 */
export const createApiClient = (baseUrl: string): ApiClient => {
  // A base without a trailing slash makes new URL() treat its last segment as a
  // file and drop it, so a Worker published under a sub-path would lose the
  // prefix. Normalizing both sides keeps the prefix and avoids a doubled slash.
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  const resolveUrl = (path: string) =>
    new URL(path.replace(/^\//, ""), base).toString();

  return { resolveUrl };
};
