# Zipnami Web MVP UI Design

## 1. Scope and Ownership

This document is the source of truth for the Zipnami Web MVP user interface. It refines [design.md](./design.md) and Issues [#5](https://github.com/kishimin/random-postal-code/issues/5) through [#10](https://github.com/kishimin/random-postal-code/issues/10), and [#16](https://github.com/kishimin/random-postal-code/issues/16) through [#17](https://github.com/kishimin/random-postal-code/issues/17).

The Web UI owns presentation, client state, browser-local history, map actions, optional advertising surfaces, consent presentation, and accessible feedback. It consumes but does not redefine the contracts in [api-design.md](./api-design.md).

## 2. Experience Principles

- One primary action generates a postal code; the initial screen never generates automatically.
- The postal code and all associated addresses are the primary content.
- Maps, ads, and consent are optional capabilities and never gate core results.
- Information remains usable with keyboard input, screen readers, zoom, large text, reduced motion, and third-party failures.
- The MVP UI language is Japanese. Product and API type names remain implementation concerns, not display labels.

## 3. Information Architecture

### 3.1 Web Routes

| Route      | Page      | Purpose                                                                       |
| ---------- | --------- | ----------------------------------------------------------------------------- |
| `/`        | Generator | Generate, inspect, copy, map, and revisit results                             |
| `/privacy` | Privacy   | Explain first-party storage, third-party processing, attribution, and contact |

Two further destinations have no route of their own.

| Destination  | Reached when                                            | Purpose                                                               |
| ------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Not found    | A requested path matches no route above                 | State that the address is wrong and offer a way back to the generator |
| Global error | A render fails in a way that would leave no usable page | State that the screen could not be shown and offer a way back         |

Direct navigation and refresh must resolve both routes through the Pages SPA fallback.

The fallback answers every path with `index.html`, so Pages cannot distinguish a
mistyped address from a real one and never returns a 404 itself. The router is
what draws that line: a path it does not claim renders the not-found
destination. Both destinations keep the header, the main landmark, and the
footer attribution that the routed screens carry. Neither exposes internal error
detail.

Android routes and navigation are V2 work tracked by Issues #12 through #15 and #20. They are not Web MVP requirements.

### 3.2 Where the Global Error Destination Renders

The global error destination has two forms. Which one answers is decided by
where the failure happened, because that decides how much of the frame is left.

| Failure                   | Renders                  | Why                                                       |
| ------------------------- | ------------------------ | --------------------------------------------------------- |
| A route's own component   | Content without a frame  | The layout is still mounted around it                     |
| The shared layout itself  | A full screen with frame | The router replaced the layout; nothing else supplies one |
| Anything above the router | A full screen with frame | There is no router left to render a frame                 |

A single full-screen form cannot serve all three. Inside a layout that is still
mounted it produces a second banner, a second contentinfo, and a `main`
landmark nested in another. A single content-only form cannot either: the two
lower rows leave nothing around it, so the header and footer attribution this
section requires would be absent.

The router decides this before any error boundary above it can, so the choice
belongs to the route configuration rather than to a boundary. A boundary
outside the router is still required — it answers the third row, which the
router never sees.

## 4. Primary State Model

The Generator feature owns an exclusive state instead of independent loading, data, and error booleans.

```ts
type GeneratorState =
  | { status: "idle" }
  | { status: "loading"; previousResult?: PostalCode }
  | { status: "success"; result: PostalCode }
  | { status: "error"; error: UiError; previousResult?: PostalCode };

type UiError =
  | { kind: "offline" }
  | { kind: "service-unavailable"; requestId?: string }
  | { kind: "invalid-response"; requestId?: string }
  | { kind: "unexpected"; requestId?: string };
```

- Idle shows instructions and the generate action with an empty result region.
- Loading disables only duplicate generation. Navigation, prior result, and history remain usable.
- Success replaces the current result and prepends it to local history exactly once.
- Error shows an understandable retry action. When a prior result exists, it remains visible and is not reinserted into history.
- A failed request never creates a history entry.

## 5. Web Page Design

### 5.1 Generator Layout

```text
+------------------------------------------------------+
| Header: Zipnami                         Privacy       |
+------------------------------------------------------+
| Intro                                                |
| [ Generate a postal code ]                           |
| Status / error / retry                               |
+-----------------------------+------------------------+
| Current result              | Map                    |
| 100-0001  [Copy]            | selected address       |
| Address list                | embedded map/fallback  |
+-----------------------------+------------------------+
| Recent history (up to 20)                            |
+------------------------------------------------------+
| Reserved advertisement region                       |
+------------------------------------------------------+
| Japan Post attribution | Privacy | Contact           |
+------------------------------------------------------+
```

Below `1024px`, result and map stack in one column. At and above `1024px`, they use two columns with the result first in DOM and reading order. The content container is fluid with a maximum width of `1200px`; no primary content or action may require horizontal scrolling at a `320px` viewport. History remains below the current result so older entries never compete with the primary action.

### 5.2 Web Components and Ownership

```text
src/
  app/
    routes/                    # Generator and Privacy route composition
  api/                         # API client and runtime response validation
  features/postal-generator/
    components/                # GenerateAction, CurrentResult, AddressList
    hooks/                     # Request lifecycle and feature orchestration
  features/history/
    components/                # HistoryList and HistoryItem
    storage/                   # Versioned browser persistence adapter
  features/maps/
    components/                # AddressMap and MapFallback
  features/advertising/        # AdSense slot and consent boundary
  components/ui/               # Presentation-only reusable controls
```

Shared `ui` components extend native HTML props and do not fetch data, navigate, or access global state. Feature components own domain presentation. Route components compose features and own page-level navigation. Do not generalize a component until at least two real consumers require the same presentation contract.

### 5.3 Current Result

- Display the postal code visually as `NNN-NNNN` while preserving the canonical seven-digit value for API and storage.
- The copy action copies the canonical seven digits unless Issue #6 explicitly changes the user contract before implementation.
- Render every address in source order; do not collapse multiple addresses into a summary.
- The first address is the initial map selection.
- Selecting another address changes only the map target, not the current result or history.
- Every address provides a clearly named external Google Maps link with an encoded full-address query.

Copy success is announced in a polite status region and does not move focus. Copy failure leaves the result usable and offers a concise error near the action.

### 5.4 Web History

Each history entry stores the canonical `PostalCode`, all addresses, and no server identifier. New successful generations are prepended, duplicates are retained, and entries beyond 20 are removed from the end. Corrupt or unsupported persisted data is discarded or migrated without blocking generation.

History entries are initially collapsed to postal code plus primary address when space is constrained, but every stored address remains reachable through an explicit expand control. Expanding history must not change the current map selection unless the user explicitly chooses a map action from that entry.

## 6. Android V2 Boundary

Android screen design, device-local history, external Android map intents, AdMob, UMP, and Google Play delivery are V2 work tracked by Issues #12 through #15 and #20. They are intentionally not implementation or acceptance requirements for this document.

## 7. Web Maps, Advertising, and Consent

The Web map occupies a labeled region after a result exists. Before generation, the region may be absent rather than displaying an empty iframe. Loading and failure states reserve enough space to avoid disruptive layout shifts. A map failure shows a fallback with the selected address and external link.

Advertising uses a dedicated region labeled as advertising where required. An unavailable, blocked, or unfilled ad collapses safely or retains a non-interactive reserved region according to the SDK contract; it never displays an application error. Consent failure follows the most privacy-preserving supported advertising mode and never blocks generation.

## 8. Accessibility Contract

- Use one `h1` per page and hierarchical headings for result, map, and history regions.
- Use native `button`, `a`, and list semantics before ARIA alternatives.
- Provide visible focus and logical focus order matching DOM order.
- Keep interactive targets at least `44px` in each dimension where layout permits and never below WCAG minimum spacing requirements.
- Announce loading, successful results, copy feedback, and request errors without repeatedly announcing unchanged content.
- Set `aria-busy` on the result region during generation; do not move focus automatically to ordinary success content.
- Move focus to an error summary only when immediate action is required; otherwise announce it through an assertive or polite region appropriate to urgency.
- Give every address map action a unique accessible name containing enough address context.
- Support browser zoom to 200%, text enlargement, screen orientation changes, and reduced motion.
- Do not convey selection, loading, success, error, or advertising status by color alone.

## 9. Visual and Content Contract

- Use the existing Zipnami logo and favicon assets without embedding text alternatives into decorative images.
- Keep postal codes visually prominent and use tabular numerals when the chosen font supports them.
- Use a spacing scale based on `4px` increments and preserve whitespace between primary action, result, history, and advertising.
- Maintain sufficient text and control contrast in every supported theme.
- Avoid meaning-dependent animation; any decorative motion respects reduced-motion preferences.
- Japanese display strings live in UI-owned resources rather than API models. The MVP does not expose a language selector.

Exact color, typography, and elevation tokens are fixed when the UI foundation is implemented and must be documented without changing the information hierarchy in this file.

## 10. Responsive Verification

Verify at minimum:

- narrow phone: `320px` and `390px` widths;
- tablet: `768px` width;
- desktop: `1024px` and `1440px` widths;
- 200% browser zoom;
- portrait and landscape orientations where supported.

Tests assert content availability and state behavior, not exact pixel appearance. Use visual regression baselines for stable representative states after visual tokens are fixed.

## 11. Test Contract

- Small tests cover pure formatting, state reduction, history retention, storage validation, URL construction, and component behavior without real services.
- Medium tests cover route navigation, API client boundaries, browser persistence, and map/ad adapters with controlled substitutes.
- Large tests cover representative deployed Pages-to-Workers journeys and production-like Web SDK configuration without real advertisement interaction.
- User interaction tests use user-level interactions rather than dispatching isolated DOM events.
- Route transition tests use the production route configuration rather than test-only routes.
- Accessibility automation covers stable Web states, supplemented by keyboard, screen-reader, and zoom checks.

Classify tests by actual dependencies, not by component, integration, or E2E labels. Every overall coverage metric must reach at least 80% when repository coverage commands exist.

## 12. Unresolved Implementation Details

The UI foundation Issues resolve:

- exact design tokens and supported theme behavior;
- the component library, if any;
- browser persistence adapters and version keys;
- exact Japanese copy and contact destination;
- clipboard output with or without the display hyphen; and
- SDK-specific empty-ad and consent presentation.

These decisions must preserve the state model, information order, optional-service isolation, and accessibility contract above.
