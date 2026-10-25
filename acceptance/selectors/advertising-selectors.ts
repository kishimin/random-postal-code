/*
 * What the Issue #9 acceptance test locates the advertising boundary by.
 *
 * ui-design.md section 12 leaves the exact Japanese copy and the SDK-specific
 * presentation to the Issue that builds the screen, so each expression below
 * fixes only what a visitor or the network needs to recognise, not the sentence
 * or the markup around it. Holding them here rather than in the Page Object
 * keeps a copy change to one edit (ADR-0054); the MVP ships Japanese only
 * (ui-design.md section 9), so there is no locale to select between.
 */
export const advertisingSelectors = {
  /*
   * How a visitor recognises the advertising region.
   *
   * ui-design.md section 7 requires "a dedicated region labeled as
   * advertising", and section 8 forbids conveying advertising status by colour
   * alone. Together those make a readable label the contract, so the label is
   * what the test locates by. Which of these words the implementation picks is
   * still its own choice.
   */
  regionLabel: /広告|スポンサー|Advertisement|Sponsored/i,
} as const;

/*
 * The AdSense display unit.
 *
 * `ins.adsbygoogle` is Google's own placement contract, not Zipnami's internal
 * markup, so depending on it is the same kind of dependency as depending on the
 * shape of `GET /api/random` — an external interface the Issue is about
 * integrating. AdSense offers no other way to place a display unit, so an
 * implementation that satisfies "Integrate Google AdSense" renders one.
 */
export const adSlotSelector = "ins.adsbygoogle";

/*
 * The per-slot test-ad flag.
 *
 * `data-adtest="on"` is AdSense's documented way to ask for test ads instead of
 * live ones, and it is rendered by the application into its own page, which is
 * why "Test ad configuration is used outside production" is observable here at
 * all. It is the configuration itself, not a claim about an account setting
 * that exists only inside a Google console.
 */
export const testAdSlotSelector = '[data-adtest="on"]';

/*
 * Every host the advertising and consent boundary may reach.
 *
 * The test never lets a request leave for any of them. Which script the
 * implementation loads — the AdSense tag, a Google-served consent message, or
 * both — is still open (ui-design.md section 12), so the pattern covers the
 * whole family rather than naming one endpoint the Issue has not chosen.
 */
export const advertisingRequestPattern =
  /^https?:\/\/(?:[a-z0-9-]+\.)*(?:googlesyndication\.com|doubleclick\.net|googletagservices\.com|googletagmanager\.com|adtrafficquality\.google|fundingchoicesmessages\.google\.com)\//i;

/*
 * The AdSense loader script specifically.
 *
 * Counted on its own so "advertisement requests are not retried indefinitely"
 * measures attempts the application makes. When this request fails, Google's
 * SDK never runs, so every further attempt is the application's own.
 */
export const advertisingScriptPattern =
  /^https?:\/\/(?:[a-z0-9-]+\.)*googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/i;

/*
 * Stands in for the AdSense SDK.
 *
 * ui-design.md section 11 asks Medium tests to exercise the ad adapter with a
 * controlled substitute, and a filled ad is the case the layout criteria are
 * about: an advertisement that never renders cannot overlap anything, so
 * testing against an empty slot would hold nothing. This gives the slot the one
 * observable effect the real SDK has that those criteria depend on — a filled
 * unit occupying space — and nothing else. It contacts no Google service.
 *
 * The height is arbitrary. It exists so the region has an area to compare, and
 * no assertion reads it.
 */
export const advertisingSdkSubstitute = `
(() => {
  const fillSlots = () => {
    for (const slot of document.querySelectorAll("ins.adsbygoogle")) {
      if (slot.getAttribute("data-ad-status") === "filled") {
        continue;
      }

      slot.setAttribute("data-ad-status", "filled");
      slot.style.display = "block";
      slot.style.height = "120px";
    }
  };

  // The real SDK replaces the queue the page pushes slots onto, and processes
  // whatever was pushed before it arrived.
  const queue = (window.adsbygoogle = window.adsbygoogle || []);
  const enqueue = Array.prototype.push.bind(queue);
  queue.push = (...slots) => {
    const length = enqueue(...slots);
    fillSlots();
    return length;
  };
  queue.loaded = true;

  fillSlots();

  // A slot rendered after this script runs is filled when it appears, which is
  // also how the real SDK behaves for slots pushed later.
  new MutationObserver(fillSlots).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
`;
