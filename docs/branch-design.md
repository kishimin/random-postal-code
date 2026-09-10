# Zipnami Git Branch Design

## 1. Purpose

This document is the source of truth for decomposing the [Zipnami MVP Design](./design.md) and [tracker Issue #22](https://github.com/kishimin/random-postal-code/issues/22) into reviewable Git branches.

## 2. Branch Workflow Contract

- Treat `main` as a shared, stable branch. Do not commit or push directly to it.
- Create every short-lived work branch from the latest `main` and integrate it through a pull request.
- Use one purpose, one Issue, and one pull request per branch.
- Name branches `{type}/{issue-number}-{short-description}`.
- Use `feature/` for user-facing or domain behavior, `fix/` for defects, `refactor/` for behavior-preserving restructuring, `docs/` for documentation only, `test/` for tests only, and `chore/` for maintenance.
- Do not use `feat/` for branches; reserve `feat:` for feature commits.
- Create a later branch from an updated `main` only after the prerequisite Issues in the table have been merged.
- Do not configure a work branch to track `origin/main`.
- Pushing, opening a pull request, merging, rebasing, and deleting branches each require an explicit request or dedicated workflow.

## 3. Commit Design

For code changes, commit one behavior at a time:

1. `test:` — fix an observable requirement in a failing test.
2. `feat:` or `fix:` — add the smallest implementation that passes the test.
3. `refactor:` — improve structure only when needed while remaining Green.

Use `docs:` for documentation-only changes and `chore:` for maintenance such as CI or dependency configuration that does not directly change user behavior. Every commit has an imperative English summary, a blank line, and a body explaining why. Do not mix generated output, secrets, or unrelated changes into a commit.

## 4. Implementation Order

Issue #22 is the tracker and has no implementation branch. The order below is a safe linear merge sequence that resolves dependencies. Parallel work must still branch from a `main` that contains every listed prerequisite.

| Order | Issue | Branch | Prerequisite Issues | Owned scope |
| ---: | ---: | --- | --- | --- |
| 1 | [#1](https://github.com/kishimin/random-postal-code/issues/1) | `chore/1-bootstrap-monorepo` | None | Bun workspace, shared configuration, existing asset relocation, local quality commands |
| 2 | [#2](https://github.com/kishimin/random-postal-code/issues/2) | `feature/2-shared-contracts` | #1 | `Address`, `PostalCode`, and API success and failure contracts |
| 3 | [#3](https://github.com/kishimin/random-postal-code/issues/3) | `feature/3-normalize-postal-data` | #1, #2 | Japan Post retrieval, normalization, and deterministic artifact |
| 4 | [#4](https://github.com/kishimin/random-postal-code/issues/4) | `feature/4-random-postal-api` | #2, #3 | Hono Worker, `GET /api/random`, and uniform selection |
| 5 | [#5](https://github.com/kishimin/random-postal-code/issues/5) | `feature/5-web-frontend-foundation` | #1, #2 | React/Vite SPA, Pages configuration, and frontend structure |
| 6 | [#6](https://github.com/kishimin/random-postal-code/issues/6) | `feature/6-web-random-experience` | #4, #5 | Web generation, display, copy, regeneration, and primary states |
| 7 | [#7](https://github.com/kishimin/random-postal-code/issues/7) | `feature/7-web-history` | #6 | Browser history, 20-entry limit, and duplicate retention |
| 8 | [#8](https://github.com/kishimin/random-postal-code/issues/8) | `feature/8-web-google-maps` | #6 | Maps Embed, address selection, and external map links |
| 9 | [#9](https://github.com/kishimin/random-postal-code/issues/9) | `feature/9-web-adsense-consent` | #6 | AdSense, consent, and isolation from core behavior |
| 10 | [#10](https://github.com/kishimin/random-postal-code/issues/10) | `feature/10-privacy-attribution` | #5 | `/privacy`, information screen, attribution, and data-processing disclosures |
| 11 | [#11](https://github.com/kishimin/random-postal-code/issues/11) | `feature/11-api-cors-secrets` | #4, #5 | Exact-origin CORS, environment validation, and secret boundaries |
| 12 | [#12](https://github.com/kishimin/random-postal-code/issues/12) | `feature/12-expo-android-foundation` | #1, #2 | Expo Router, Android foundation, and environment configuration |
| 13 | [#13](https://github.com/kishimin/random-postal-code/issues/13) | `feature/13-android-random-experience` | #4, #12 | Android API retrieval, display, regeneration, and primary states |
| 14 | [#14](https://github.com/kishimin/random-postal-code/issues/14) | `feature/14-android-history-maps` | #13 | Device history, 20-entry limit, and external map integration |
| 15 | [#15](https://github.com/kishimin/random-postal-code/issues/15) | `feature/15-android-admob-consent` | #10, #13 | AdMob banner, UMP, test ads, and failure isolation |
| 16 | [#16](https://github.com/kishimin/random-postal-code/issues/16) | `feature/16-accessibility-responsive` | #7, #8, #9, #14, #15 | Cross-client accessibility and responsive verification |
| 17 | [#17](https://github.com/kishimin/random-postal-code/issues/17) | `feature/17-failure-isolation` | #8, #9, #11, #14, #15 | API, Maps, ads, consent, and external-app failure boundaries |
| 18 | [#18](https://github.com/kishimin/random-postal-code/issues/18) | `chore/18-ci-quality-gates` | #16, #17 | Formatting, types, lint, tests, coverage, and builds for every workspace |
| 19 | [#19](https://github.com/kishimin/random-postal-code/issues/19) | `chore/19-deploy-pages-workers` | #10, #11, #18 | Independent Pages/Workers deployment, configuration, rollback, and smoke check |
| 20 | [#20](https://github.com/kishimin/random-postal-code/issues/20) | `chore/20-android-play-release` | #15, #16, #17, #18 | AAB, store assets, Data Safety, test track, and permission review |
| 21 | [#21](https://github.com/kishimin/random-postal-code/issues/21) | `test/21-mvp-acceptance` | #19, #20 | Final Web and Android acceptance tests and reproducible evidence |

## 5. Starting a Branch

Before starting a branch:

1. Read the target Issue and [design.md](./design.md) in full.
2. Read every applicable ADR and Skill.
3. Confirm that `main` contains the merged prerequisite Issues.
4. Confirm that the working tree has no unrelated changes that would carry over.
5. Create the exact branch name in the table from the latest stable `main`.
6. Derive a test list from the Issue acceptance criteria.

Use only branch-creation and verification commands that the repository actually defines at that point. Do not guess package script names in advance.

## 6. Branch Completion Gates

A branch is complete only when all applicable conditions hold:

- The target Issue acceptance criteria are satisfied without adding out-of-scope behavior.
- Public contracts, implementation, tests, and documentation agree.
- The TDD test list is empty and the Red/Green/Refactor history is explainable.
- Every available repository formatter passes.
- Every available type check or compiler passes.
- Every available linter or static analyzer passes.
- Focused and regression tests pass.
- Every metric in the overall coverage summary is at least 80%.
- Every available production build passes.
- Skill-based code review has no unresolved material finding.
- Changed files, diff, staged scope, and absence of secrets have been checked.
- Every commit follows the English message convention and explains why.
- The pull request references its Issue and records prerequisites and verification results.

Do not invent an unavailable verification command. Record its skip reason in the pull request. A branch cannot be complete while any available required check fails.

## 7. Change Management

When a design change affects existing Issue acceptance criteria or multiple branches, update the design contract and Issues before embedding it in an implementation branch. Give new independent scope its own Issue and branch instead of expanding an existing branch's purpose.

Apply a correction to merged work through a new `fix/` branch or another appropriate branch type. Do not rewrite shared history through amend, rebase, or force push.
