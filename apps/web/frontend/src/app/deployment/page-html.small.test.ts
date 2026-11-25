import { describe, expect, test } from "vitest";
import { pageHtmlFor, type PageHtml } from "./page-html";

// The shape Vite writes dist/index.html in: the title and description of
// index.html, then the bundle's tags, then the empty root.
const template = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>Zipnami</title>
    <meta
      name="description"
      content="the site default"
    />
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const page: PageHtml = {
  body: "<main>about</main>",
  title: "About | Zipnami",
  description: "About this site",
  canonicalUrl: "https://zipnami.pages.dev/about",
  noindex: false,
  adSenseAccount: null,
};

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

const metaContents = (html: string, name: string) =>
  [...parse(html).head.querySelectorAll(`meta[name="${name}"]`)].map((meta) =>
    meta.getAttribute("content"),
  );

describe("pageHtmlFor", () => {
  test("puts the page's markup inside the root", () => {
    const root = parse(pageHtmlFor(template, page)).getElementById("root");

    expect(root?.innerHTML).toBe("<main>about</main>");
  });

  test("replaces the template's title", () => {
    const document = parse(pageHtmlFor(template, page));

    expect(document.title).toBe("About | Zipnami");
    expect(document.querySelectorAll("title")).toHaveLength(1);
  });

  test("replaces the template's description with the page's own, leaving one", () => {
    expect(metaContents(pageHtmlFor(template, page), "description")).toEqual([
      "About this site",
    ]);
  });

  test("names the page's canonical URL once", () => {
    const links = parse(pageHtmlFor(template, page)).head.querySelectorAll(
      'link[rel="canonical"]',
    );

    expect([...links].map((link) => link.getAttribute("href"))).toEqual([
      "https://zipnami.pages.dev/about",
    ]);
  });

  // The not-found page is not a page to index, and it has no address of its
  // own to name as canonical.
  test("names no canonical URL and asks not to be indexed for a page without an address", () => {
    const html = pageHtmlFor(template, {
      ...page,
      canonicalUrl: null,
      noindex: true,
    });

    expect(parse(html).head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(metaContents(html, "robots")).toEqual(["noindex"]);
  });

  test("asks for no robots rule on an indexable page", () => {
    expect(metaContents(pageHtmlFor(template, page), "robots")).toEqual([]);
  });

  test("names the AdSense account in the head when there is one", () => {
    const html = pageHtmlFor(template, {
      ...page,
      adSenseAccount: "ca-pub-1234567890123456",
    });

    expect(metaContents(html, "google-adsense-account")).toEqual([
      "ca-pub-1234567890123456",
    ]);
  });

  test("emits no AdSense account tag without one", () => {
    expect(
      metaContents(pageHtmlFor(template, page), "google-adsense-account"),
    ).toEqual([]);
  });

  test("keeps the bundle's script tag", () => {
    expect(pageHtmlFor(template, page)).toContain(
      '<script type="module" crossorigin src="/assets/index-abc.js"></script>',
    );
  });

  // The description is prose and may carry characters HTML gives meaning to.
  test("escapes text written into attributes and the title", () => {
    const html = pageHtmlFor(template, {
      ...page,
      title: "a < b | Zipnami",
      description: 'say "hi" & <go>',
    });
    const document = parse(html);

    expect(document.title).toBe("a < b | Zipnami");
    expect(metaContents(html, "description")).toEqual(['say "hi" & <go>']);
  });

  test.each([
    ["root", template.replace('<div id="root"></div>', "")],
    ["head", template.replace("</head>", "")],
  ])("refuses a template without its %s", (_name, broken) => {
    expect(() => pageHtmlFor(broken, page)).toThrow(/HTML template/);
  });
});
