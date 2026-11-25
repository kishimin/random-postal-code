import {
  robotsTxtFor,
  sitemapXmlFor,
  SITEMAP_PATH,
} from "../deployment/crawl-files";
import { pageHtmlFor } from "../deployment/page-html";
import { canonicalUrlOf } from "../deployment/site-origin";
import { buildPages } from "./prerender-pages";

/** One file of the build output: its path inside the build, and its text. */
export type SiteFile = {
  readonly file: string;
  readonly contents: string;
};

/**
 * Every file the build writes next to the bundle for crawlers (Issue #169):
 * one HTML file per content route, the not-found page as 404.html, robots.txt
 * and sitemap.xml.
 *
 * This is the entry of the build's server-side pass (vite.config.ts), which
 * writes what it returns. The sitemap is listed from the pages that were
 * rendered, so it cannot name a route that has no file or leave one out.
 * @param {string} template - The built index.html, which each page is made
 * from.
 * @param {string | null} adSenseAccount - The publisher every page names in
 * its head, or null for a build without a real one.
 */
export const buildSiteFiles = async (
  template: string,
  adSenseAccount: string | null,
): Promise<SiteFile[]> => {
  const pages = await buildPages();

  const pageFiles = pages.map(({ file, path, body, metadata }) => ({
    file,
    contents: pageHtmlFor(template, {
      body,
      title: metadata.title,
      description: metadata.description,
      canonicalUrl:
        metadata.canonicalPath === null
          ? null
          : canonicalUrlOf(metadata.canonicalPath),
      // The not-found screen is no page to list in a search index.
      noindex: path === null,
      adSenseAccount,
    }),
  }));
  const routes = pages.flatMap(({ path }) => (path === null ? [] : [path]));

  return [
    ...pageFiles,
    {
      file: "robots.txt",
      contents: robotsTxtFor(canonicalUrlOf(SITEMAP_PATH)),
    },
    {
      file: SITEMAP_PATH.slice(1),
      contents: sitemapXmlFor(routes),
    },
  ];
};
