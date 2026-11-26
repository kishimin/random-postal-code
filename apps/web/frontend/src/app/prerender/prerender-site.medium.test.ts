import { describe, expect, test } from "vitest";
import {
  allGuidePages,
  guideIndexPage,
} from "../../features/guides/guide-pages";
import { canonicalUrlOf } from "../deployment/site-origin";
import { contentRoutePaths, pageMetadataFor } from "../page-metadata";
import { buildSiteFiles, type SiteFile } from "./prerender-site";

/*
 * Everything the build writes next to the bundle for crawlers (Issue #169),
 * as the plugin in vite.config.ts receives it: the files, not the writing. The
 * template is the shape Vite gives dist/index.html.
 */
const template = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>Zipnami</title>
    <meta name="description" content="the site default" />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const publisher = "ca-pub-1234567890123456";

const files = await buildSiteFiles(template, publisher);
const filesWithoutPublisher = await buildSiteFiles(template, null);

const contentsOf = (all: readonly SiteFile[], file: string) =>
  all.find((candidate) => candidate.file === file)?.contents ?? "";

const htmlFiles = (all: readonly SiteFile[]) =>
  all.filter(({ file }) => file.endsWith(".html"));

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

describe("buildSiteFiles", () => {
  test("writes a file for each content route, the not-found page, robots.txt and sitemap.xml", () => {
    expect(files.map(({ file }) => file).sort()).toEqual(
      [
        "index.html",
        "about.html",
        "guide/postal-code.html",
        "guide/address.html",
        "guide/data.html",
        "guide/how-to-use.html",
        "privacy.html",
        "404.html",
        "robots.txt",
        "sitemap.xml",
      ].sort(),
    );
  });

  test("puts each page's own title, description and canonical URL in its head, over the template's", () => {
    for (const path of contentRoutePaths) {
      const file = path === "/" ? "index.html" : `${path.slice(1)}.html`;
      const document = parse(contentsOf(files, file));
      const metadata = pageMetadataFor(path);

      expect(document.title, path).toBe(metadata.title);
      expect(
        document.head
          .querySelector('meta[name="description"]')
          ?.getAttribute("content"),
        path,
      ).toBe(metadata.description);
      expect(
        document.head
          .querySelector('link[rel="canonical"]')
          ?.getAttribute("href"),
        path,
      ).toBe(canonicalUrlOf(path));
    }
  });

  test("keeps the template's bundle tags on every page", () => {
    for (const { file, contents } of htmlFiles(files)) {
      expect(contents, file).toContain('src="/assets/index-abc.js"');
    }
  });

  test("puts the not-found screen in 404.html, outside the index and with no canonical URL", () => {
    const document = parse(contentsOf(files, "404.html"));

    expect(document.querySelector("h1")?.textContent).toBe(
      "ページが見つかりません",
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(
      document.head
        .querySelector('meta[name="robots"]')
        ?.getAttribute("content"),
    ).toBe("noindex");
  });

  test("leaves the content pages open to the index", () => {
    for (const guide of [...allGuidePages, guideIndexPage]) {
      const document = parse(contentsOf(files, `${guide.path.slice(1)}.html`));

      expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    }
  });

  test("names the publisher in every page's head when the build has one, and in none when it has none", () => {
    const accounts = (all: readonly SiteFile[]) =>
      htmlFiles(all).map(({ file, contents }) => [
        file,
        [
          ...parse(contents).head.querySelectorAll(
            'meta[name="google-adsense-account"]',
          ),
        ].map((meta) => meta.getAttribute("content")),
      ]);

    expect(accounts(files)).toEqual(
      htmlFiles(files).map(({ file }) => [file, [publisher]]),
    );
    expect(accounts(filesWithoutPublisher)).toEqual(
      htmlFiles(files).map(({ file }) => [file, []]),
    );
  });

  test("lists exactly the content routes in the sitemap, as production URLs", () => {
    const locations = [
      ...contentsOf(files, "sitemap.xml").matchAll(/<loc>([^<]*)<\/loc>/g),
    ].map(([, url]) => url);

    expect(locations.sort()).toEqual(
      contentRoutePaths.map(canonicalUrlOf).sort(),
    );
  });

  test("names the sitemap in robots.txt", () => {
    expect(contentsOf(files, "robots.txt")).toContain(
      `Sitemap: ${canonicalUrlOf("/sitemap.xml")}`,
    );
  });
});
