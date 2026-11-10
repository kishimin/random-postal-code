/** The route of each guide page, in the order the footer lists them. */
export type GuidePath =
  | "/about"
  | "/guide/postal-code"
  | "/guide/address"
  | "/guide/data"
  | "/guide/how-to-use";

/** A page a guide cites as the source of its claims. */
export type GuideSource = {
  readonly label: string;
  readonly href: string;
};

/** One body section: a region named by its own visible h2. */
export type GuideSection = {
  /** The id its h2 carries, which names the section's region. */
  readonly headingId: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
};

/** The copy of one guide page (ui-design.md section 5.5). */
export type GuidePage = {
  readonly path: GuidePath;
  /** The h1, the footer link, and the document title's page name. */
  readonly name: string;
  /** The meta description: the page's own one-sentence summary. */
  readonly description: string;
  readonly lead: string;
  readonly sections: readonly GuideSection[];
  readonly sources: readonly GuideSource[];
};
