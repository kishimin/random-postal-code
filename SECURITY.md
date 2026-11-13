# Security policy

## Supported versions

Only the version that https://zipnami.pages.dev serves receives security
fixes. It is always the latest release on `main`.

| Version                | Supported |
| ---------------------- | --------- |
| Latest release (1.x)   | Yes       |
| Earlier releases (0.x) | No        |

## Reporting a vulnerability

Please do not open a public Issue for a vulnerability. A public report shows
everyone how to use the flaw before a fix is deployed.

Report it privately instead:

1. Open the repository's
   [Security tab](https://github.com/kishimin/random-postal-code/security).
2. Select **Report a vulnerability**.
3. Describe what you found, how to reproduce it, and what it lets an attacker
   do.

Only the maintainer can read the report. You will get a reply in the same
advisory, and you will be credited in it when the fix is published, unless
you ask not to be.

## Scope

In scope:

- The site at https://zipnami.pages.dev and its API on Cloudflare Workers.
- The code in this repository.

Out of scope:

- Google AdSense, Google Analytics, and Google Maps, which the site embeds.
  Report those to Google.
- Denial of service through traffic volume, and findings that need a
  compromised device or browser.
