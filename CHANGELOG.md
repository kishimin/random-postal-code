# Changelog

Every version of Zipnami that production has served, or is about to serve.
From v1.0.0 on, [release-please](https://github.com/googleapis/release-please)
generates each entry from the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
merged to `main`, and versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
`fix:` is a patch, `feat:` a minor, and `!` or `BREAKING CHANGE` a major release.
All workspaces share one version, because they ship as one site.

## [1.2.0](https://github.com/kishimin/random-postal-code/compare/v1.1.0...v1.2.0) (2026-11-28)


### Features

* build and upload an English demo video with the same commands ([#167](https://github.com/kishimin/random-postal-code/issues/167)) ([877cf92](https://github.com/kishimin/random-postal-code/commit/877cf9298a8012d6e1c8ff1e30b753ff89a31853)), closes [#165](https://github.com/kishimin/random-postal-code/issues/165)
* build the edited demo video from the six recordings with one command ([#163](https://github.com/kishimin/random-postal-code/issues/163)) ([a20179a](https://github.com/kishimin/random-postal-code/commit/a20179ab19ba323c2febcaef0455e63447ee4034))
* prerender the content routes with robots.txt, a sitemap and real 404s ([#171](https://github.com/kishimin/random-postal-code/issues/171)) ([630f51c](https://github.com/kishimin/random-postal-code/commit/630f51c7c3be7d179f8b5e842e8e8a2579176930))
* record the v1.0.0 demo journey in all six browsers with one command ([#155](https://github.com/kishimin/random-postal-code/issues/155)) ([1f2ff1f](https://github.com/kishimin/random-postal-code/commit/1f2ff1f10b224ba287d84ee76a5e314224529dc3))
* underline the mobile address links and tint them while pressed ([#176](https://github.com/kishimin/random-postal-code/issues/176)) ([d4f26b3](https://github.com/kishimin/random-postal-code/commit/d4f26b3c0660b483621825460ee4116c1d59244a))
* upload the demo video to YouTube as private with chapters and a thumbnail ([#164](https://github.com/kishimin/random-postal-code/issues/164)) ([d9b0b41](https://github.com/kishimin/random-postal-code/commit/d9b0b4149a74390ba1de4f8f0db938f7f7824ddb))


### Bug Fixes

* drop the generator and version suffix from the demo video title ([#166](https://github.com/kishimin/random-postal-code/issues/166)) ([634e090](https://github.com/kishimin/random-postal-code/commit/634e090c84c385ddc7a61c02f93cf4ea131cd981))
* keep Room database constructors so the Android release build starts ([#168](https://github.com/kishimin/random-postal-code/issues/168)) ([804adba](https://github.com/kishimin/random-postal-code/commit/804adbab99f27af7a3e161afd89312186dec6e7c)), closes [#20](https://github.com/kishimin/random-postal-code/issues/20)
* stop showing the API address on the mobile information screen ([#177](https://github.com/kishimin/random-postal-code/issues/177)) ([663a2e5](https://github.com/kishimin/random-postal-code/commit/663a2e59afd41ec9cad46863d28fe9fc03db2ae4)), closes [#175](https://github.com/kishimin/random-postal-code/issues/175)

## [1.1.0](https://github.com/kishimin/random-postal-code/compare/v1.0.0...v1.1.0) (2026-11-18)


### Features

* run the browser tests on Firefox as a sixth project ([#153](https://github.com/kishimin/random-postal-code/issues/153)) ([48fc7f8](https://github.com/kishimin/random-postal-code/commit/48fc7f87d4270eba83f8adb43f3db2d82620f664))

## [1.0.0] - 2026-11-18

The first stable version of the Web MVP, released while the AdSense review is
still pending. The release notes are in
[docs/release-notes/v1.0.0.md](docs/release-notes/v1.0.0.md).

### Added

- Five original guide pages, linked from the footer, and an overview of the
  generator on the start screen (#121, #129).
- A トップへ戻る link at the end of each guide page that returns to the
  generator (#130).
- The logo before the wordmark in every header (#113, #122).
- `SECURITY.md`, which asks for vulnerability reports through GitHub's private
  vulnerability reporting.
- `apps/web/contact-form`: the Apps Script the owner attaches to the contact
  form, which posts each response's inquiry type and a link to the responses
  page to Discord, and never the visitor's name or message (#105).

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

[1.0.0]: https://github.com/kishimin/random-postal-code/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/kishimin/random-postal-code/releases/tag/v0.1.0
