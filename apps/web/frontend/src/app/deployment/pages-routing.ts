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
  if (pathname.split("/").includes("..")) return null;

  const route = pathname.replace(/\/+$/, "");
  const candidates = [
    ...(pathname.endsWith("/") ? [] : [pathname]),
    ...(route === "" ? [] : [`${route}.html`]),
    `${route}/index.html`,
  ];

  return candidates.find(isFile) ?? null;
};
