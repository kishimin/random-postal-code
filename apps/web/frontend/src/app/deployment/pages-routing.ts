/**
 * The built file Cloudflare Pages answers a request path with, or null when it
 * has none and answers 404.html with status 404.
 *
 * Pages looks for the file itself, then for `<path>.html`, then for
 * `<path>/index.html`. Reproduced here so `vite preview`, which would
 * otherwise answer every unmatched path with index.html like a single-page
 * application, serves what the deployment serves.
 *
 * A route is served from `<route>.html` rather than `<route>/index.html`
 * because Pages redirects `/about` to `/about/` for the latter, and a
 * crawler would be sent through that redirect to every page.
 * @param {string} pathname - The request path, without its query.
 * @param {(file: string) => boolean} isFile - Whether the build holds this
 * file, given as a path from the build directory starting with a slash.
 */
export const pagesFileFor = (
  pathname: string,
  isFile: (file: string) => boolean,
): string | null => {
  // A backslash separates directories on Windows, where `/..\x` climbs out
  // of the build directory past a check for `..` between slashes.
  if (pathname.includes("\\") || pathname.split("/").includes("..")) {
    return null;
  }

  const route = pathname.replace(/\/+$/, "");
  const candidates = [
    ...(pathname.endsWith("/") ? [] : [pathname]),
    ...(route === "" ? [] : [`${route}.html`]),
    `${route}/index.html`,
  ];

  return candidates.find(isFile) ?? null;
};

/**
 * Decodes a request path for lookup, or returns null when no file Pages could
 * serve has that name.
 *
 * Malformed percent-escapes make decodeURIComponent throw, which would answer
 * the request with a 500. A backslash or NUL that arrives encoded (`%5C`,
 * `%00`) only appears after decoding, so the check has to follow it: it is how
 * `/..%5Cpackage.json` would otherwise reach a file outside the build
 * directory on Windows.
 * @param {string} pathname - The request path as received, without its query.
 */
export const decodePagesPathname = (pathname: string): string | null => {
  try {
    const decoded = decodeURIComponent(pathname);

    return decoded.includes("\\") || decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
};
