/** What differs between one prerendered file and the next. */
export type PageHtml = {
  /** The rendered markup that goes inside the root element. */
  readonly body: string;
  readonly title: string;
  readonly description: string;
  /** The page's address, or null for a page with none (the not-found page). */
  readonly canonicalUrl: string | null;
  /** Asks search engines to leave the page out of their index. */
  readonly noindex: boolean;
  /** The publisher the page names, or null for a build without a real one. */
  readonly adSenseAccount: string | null;
};

const EMPTY_ROOT = '<div id="root"></div>';
const TITLE_ELEMENT = /<title>[\s\S]*?<\/title>\s*/;
const DESCRIPTION_META = /<meta\s+name="description"[^>]*>\s*/;

const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const meta = (name: string, content: string) =>
  `<meta name="${name}" content="${escapeHtml(content)}" />`;

const headTagsOf = (page: PageHtml): string[] => [
  `<title>${escapeHtml(page.title)}</title>`,
  meta("description", page.description),
  ...(page.canonicalUrl === null
    ? []
    : [`<link rel="canonical" href="${escapeHtml(page.canonicalUrl)}" />`]),
  ...(page.noindex ? [meta("robots", "noindex")] : []),
  ...(page.adSenseAccount === null
    ? []
    : [meta("google-adsense-account", page.adSenseAccount)]),
];

/**
 * Turns the built index.html into one page's own HTML: that page's markup in
 * the root, and its title, description, canonical URL and AdSense account in
 * the head.
 *
 * The template's title and description are dropped rather than edited in
 * place, so the head never holds two of either and the result does not depend
 * on how index.html happens to wrap its tags.
 * @param {string} template - The built index.html.
 * @param {PageHtml} page - What this page adds to it.
 */
export const pageHtmlFor = (template: string, page: PageHtml): string => {
  if (!template.includes(EMPTY_ROOT)) {
    throw new Error(`The HTML template has no ${EMPTY_ROOT} to render into.`);
  }
  if (!template.includes("</head>")) {
    throw new Error("The HTML template has no </head> to describe the page in.");
  }

  const head = headTagsOf(page)
    .map((tag) => `    ${tag}\n`)
    .join("");

  return template
    .replace(TITLE_ELEMENT, "")
    .replace(DESCRIPTION_META, "")
    .replace("</head>", () => `${head}  </head>`)
    .replace(EMPTY_ROOT, () => `<div id="root">${page.body}</div>`);
};
