// Extension included because this file is also imported by vite.config.ts,
// type checked under module: nodenext (as in ads-txt.ts).
import { canonicalUrlOf } from "./site-origin.ts";

/** Where the sitemap is served. Named by robots.txt, so one constant for both. */
export const SITEMAP_PATH = "/sitemap.xml";

/**
 * The robots.txt that lets every crawler in and points it at the sitemap.
 * @param {string} sitemapUrl - The sitemap's absolute URL.
 */
export const robotsTxtFor = (sitemapUrl: string): string =>
  `User-agent: *\nAllow: /\nSitemap: ${sitemapUrl}\n`;

/**
 * The sitemap that lists exactly the given routes, as absolute production
 * URLs.
 * @param {readonly string[]} paths - The content routes, each starting with a
 * slash.
 */
export const sitemapXmlFor = (paths: readonly string[]): string => {
  const entries = paths
    .map((path) => `  <url><loc>${canonicalUrlOf(path)}</loc></url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
};
