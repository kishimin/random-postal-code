# Changelog

Every version of Zipnami that production has served, or is about to serve.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
All four workspaces share one version, because they ship as one site.

## [1.0.0] - Unreleased

The first stable version of the Web MVP. The `v1.0.0` tag and GitHub Release
are created once #39 and #120 are closed, from the draft in
[docs/release-notes/v1.0.0.md](docs/release-notes/v1.0.0.md).

### Added

- Five original guide pages, linked from the footer, and an overview of the
  generator on the start screen (#121, #129).
- A トップへ戻る link at the end of each guide page that returns to the
  generator (#130).
- The logo before the wordmark in every header (#113, #122).
- `SECURITY.md`, which asks for vulnerability reports through GitHub's private
  vulnerability reporting.

### Changed

- Ads are requested only on the result screen. The start, loading, error,
  not-found, and privacy screens load no advertising SDK and push no ad slot
  (#120, #128).
- The desktop result is laid out as Figma node `1:4` draws it (#111, #117).
- The AdSense consent steps in `docs/deployment.md` match the current
  AdSense flow (#114, #123).
- The workspace versions read `1.0.0`, and the root `package.json` carries the
  same version.

### Fixed

- The privacy page's footer link goes home instead of to the page itself
  (#112, #119).
- The workspace medium tests and the Coverage job's tests run one workspace
  at a time, so the history test no longer times out (#126, #127).

## [0.1.0] - 2026-11-07

The first tagged version, served by production at https://zipnami.pages.dev
from commit `3c1fb75`. See the
[v0.1.0 release](https://github.com/kishimin/random-postal-code/releases/tag/v0.1.0)
for the full list.

### Added

- A uniformly random postal code from the full Japan Post dataset, served by a
  Hono API on Cloudflare Workers (#3, #4, #33, #34, #88, #99).
- Every address for the code, copying the code, and a browser-side history of
  earlier results (#6, #7).
- An embedded Google Map for each address, with a link to Google Maps (#8).
- A privacy page, and Japan Post attribution in the footer (#10).
- An AdSense slot that never blocks the page, and an `ads.txt` generated from
  the build's publisher ID (#9, #98, #110).
- Google Analytics (#92), not-found and global error screens (#26), and the
  Figma visual design (#25, #97).
- Responsive, WCAG 2.2 AA behavior checked by axe-core and keyboard tests
  (#16), and isolation from failures of Maps, ads, Analytics, and consent
  (#17).
- CORS and secret boundaries on the API (#11), and a report-only
  Content-Security-Policy (#38, #72, #73).
- Pull request quality gates and end-to-end acceptance tests (#18, #21, #104).
- Separate Pages and Workers deploys with rollback (#19, #90), deployed
  automatically after CI passes on `main` (#108).

[1.0.0]: https://github.com/kishimin/random-postal-code/compare/v0.1.0...main
[0.1.0]: https://github.com/kishimin/random-postal-code/releases/tag/v0.1.0
