/*
 * What the production tests (Issue #104) locate the deployed site by.
 *
 * The generate action reads differently in each state (Issue #97), so it is
 * matched by any of Figma's three labels, as whole strings. The other names
 * are matched on their subject, so the sentence around them stays the
 * page's own.
 */
export const productionSelectors = {
  generateAction: /^(?:ランダム生成する|もう一度、波に乗る|再試行する)$/,
  expandHistory: "履歴を展開",
  copyAction: /コピー/,
  mapRegion: /地図/,
  privacyLink: /プライバシー/,
  privacyHeading: /^プライバシーポリシー$/,
  // What Google's Maps Embed error page says, in English or Japanese.
  mapsKeyRejected:
    /Google Maps Platform rejected your request|Google マップが正しく読み込まれませんでした/i,
} as const;

/*
 * Statements /privacy has to make: the third parties it names, and the Japan
 * Post credit. Each is matched on its subject, so the sentences around it stay
 * the page's own.
 */
export const privacyStatements = {
  googleMaps: /Google\s*(?:Maps|マップ)/i,
  googleAdSense: /AdSense|アドセンス/i,
  japanPostCredit: /日本郵便[^。]*(?:公開|提供)/,
} as const;

/*
 * Every host the advertising, consent, and Analytics tags reach. The
 * production tests abort these in the browser, so an automated visit neither
 * requests an ad (which AdSense can count as invalid traffic) nor records a
 * visit in Analytics (ui-design.md section 11: "without real advertisement
 * interaction").
 *
 * It names hosts, not paths, and covers whole families (*.doubleclick.net,
 * *.google-analytics.com), because Google changes which subdomain its SDKs
 * call without notice. Google Maps (www.google.com/maps) is deliberately not
 * here: the journey needs the real embed.
 */
export const blockedThirdPartyPattern =
  /^https?:\/\/(?:[a-z0-9-]+\.)*(?:googlesyndication\.com|doubleclick\.net|googletagservices\.com|googletagmanager\.com|googleadservices\.com|adtrafficquality\.google|fundingchoicesmessages\.google\.com|adservice\.google\.[a-z.]+|google-analytics\.com|analytics\.google\.com)(?::\d+)?\//i;

// GET /api/random on whatever Worker origin the build was given.
export const randomEndpointPattern = /\/api\/random(?:\?.*)?$/;

// A link that hands the visitor off to Google Maps.
export const externalMapLinkSelector = 'a[href*="google."]';

// The Maps Embed API frame. The fallback, shown without a key or after a
// failed load, is a link, so this matches only a real embed.
export const mapEmbedSelector =
  'iframe[src^="https://www.google.com/maps/embed/"]';

// Where a loaded embed frame has navigated to.
export const mapEmbedUrlPattern = /^https:\/\/www\.google\.com\/maps\/embed\//;

// Any displayed postal code (NNN-NNNN, ui-design.md section 5.3).
export const anyDisplayedPostalCode = /\d{3}-\d{4}/;

/**
 * How a canonical seven-digit postal code reads on screen.
 * @param {string} postalCode - The seven digits the Worker returned.
 */
export const displayedPostalCode = (postalCode: string) =>
  `${postalCode.slice(0, 3)}-${postalCode.slice(3)}`;
