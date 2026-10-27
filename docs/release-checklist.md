# Web MVP release checklist

This is the written record of the checks Issue #21 asks for before the Web MVP
is released. A box is ticked only after the check it names has been run and
passed, and a box that cannot be checked yet stays open and says what it
waits for.

Each check below is reproduced by an automated test, so a later release reruns
it instead of repeating it by hand. The journeys run a production build served
by vite preview, calling a real Worker under wrangler dev, with nothing on
GET /api/random stubbed. To rerun them, run the e2e:large script in
apps/web/frontend and give it the path of the test below. The earlier
per-feature checks run against a stubbed API: the Playwright ones with the
e2e:medium script in apps/web/frontend, and Issue #11 (the Worker's CORS
boundary, which has no browser) with the test:medium script of
apps/web/backend.

The Large test is the reproducible check for every category in this document:
acceptance/web-mvp-end-to-end.large.test.ts. It runs nightly in the Frontend
E2E (Large) job of ci-nightly.yml. The Medium tests it builds on are named
under the category they support.

## Mobile

- [x] A result from the Worker fits a 390px wide screen with no horizontal
      scrolling (Large test, phone 390px, and Medium Issue #16).

## Tablet

- [x] A result from the Worker fits a 768px wide screen with no horizontal
      scrolling (Large test, tablet 768px, and Medium Issue #16).

## Desktop

- [x] A result from the Worker fits a 1440px wide screen with no horizontal
      scrolling (Large test, wide desktop 1440px, and Medium Issue #16).

## Accessibility

- [x] The WCAG A and AA axe scan finds no violations on a result filled in by
      the Worker, at each of the three widths above (Large test, and Medium
      Issue #16).

## Offline

- [x] Offline, a generation fails visibly, the last result and the history are
      kept, and the Worker answers again once back online (Large test, offline,
      and Medium Issue #17).

## Production build

- [x] The journeys run on vite preview of a vite build, and the page requests no
      development-server path (Large test, first journey).
- [x] Generation, copying, address maps, history, and the Maps, advertising,
      and consent failure cases work against the real Worker (Large test, and
      Medium Issues #6, #7, #8, #9, #17, and #39).
- [x] The Worker authorizes the site origin for a plain read, refuses a plain
      read and a preflight from other origins, and a browser on another origin
      cannot read it (Large test; the CORS rules themselves are held by Medium
      Issue #11).

## Pending deployment

These need the deployed site, so they stay open until Issue #19 is deployed.

- [ ] #19: /privacy is publicly accessible on the deployed site.
- [ ] #19: The Japan Post attribution is publicly accessible on the deployed site.
- [ ] #19: The deployed Web SDKs match what /privacy discloses.

## Evidence

The ticks above rest on these runs of the Large test and the Medium suite.

- Local run, Windows, 2026-10-28, infrastructure commit c13594c: local wrangler
  dev and vite preview. The Large test passed 10 of 10 on Chromium and 10 of 10
  on WebKit, and the e2e:medium script passed 485 tests.
- Nightly CI run, ubuntu-24.04, 2026-10-27 UTC, commit fe2f11e: the Large
  test passed 20 of 20 (10 on Chromium, 10 on WebKit) in the Frontend E2E
  (Large) job,
  https://github.com/kishimin/random-postal-code/actions/runs/40538230977
