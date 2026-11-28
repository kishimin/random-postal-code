/** The route of each guide page (ui-design.md section 5.5). */
export const guidePaths = {
  about: "/about",
  postalCode: "/guide/postal-code",
  address: "/guide/address",
  data: "/guide/data",
  howToUse: "/guide/how-to-use",
  history: "/guide/history",
  businessCode: "/guide/business-code",
  writing: "/guide/writing",
  barcode: "/guide/barcode",
  municipalityCode: "/guide/municipality-code",
} as const;

export type GuidePath = (typeof guidePaths)[keyof typeof guidePaths];

/** The route of the guide index, which lists every guide by category. */
export const guideIndexPath = "/guide";

/**
 * A screen a guide's own text may link to: another guide, the guide index,
 * or the privacy page.
 */
export type GuideLinkTarget = GuidePath | typeof guideIndexPath | "/privacy";

/** A page a guide cites as the source of its claims. */
export type GuideSource = {
  readonly label: string;
  readonly href: string;
};

/** A link from a guide's body to another screen of the site. */
export type GuideLink = {
  readonly label: string;
  readonly to: GuideLinkTarget;
};

/** One body section: a region named by its own visible h2. */
export type GuideSection = {
  /** The id its h2 carries, which names the section's region. */
  readonly headingId: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
  readonly links?: readonly GuideLink[];
};

/** The copy of one guide page (ui-design.md section 5.5). */
export type GuidePage = {
  readonly path: GuidePath;
  /** The h1, every link to the page, and the document title's page name. */
  readonly name: string;
  /** The meta description: the page's own one-sentence summary. */
  readonly description: string;
  /**
   * A short phrase shown after the page's name wherever another page links
   * to it: the guide index and the related guides.
   */
  readonly summary: string;
  readonly lead: string;
  readonly sections: readonly GuideSection[];
  /** The other guides its 関連するガイド region links to, in order. */
  readonly related: readonly GuidePath[];
  readonly sources: readonly GuideSource[];
};
