/*
 * Checks the settings a production Pages build is about to bake in, before
 * the build runs, and fails the deploy when one is unusable. It names each
 * problem setting but never prints a value (design.md section 10: "Do not
 * print secrets in deployment logs").
 *
 * Usage: VITE_...=... bun run verify:deploy-env
 */
import { problemsWithFrontendDeploySettings } from "../src/app/deployment/deploy-settings.ts";

const problems = problemsWithFrontendDeploySettings({
  VITE_API_BASE_URL: process.env.VITE_API_BASE_URL,
  VITE_GOOGLE_ADSENSE_CLIENT_ID: process.env.VITE_GOOGLE_ADSENSE_CLIENT_ID,
  VITE_GOOGLE_ADSENSE_SLOT_ID: process.env.VITE_GOOGLE_ADSENSE_SLOT_ID,
  VITE_ADSENSE_TEST_MODE: process.env.VITE_ADSENSE_TEST_MODE,
});

for (const problem of problems) {
  console.error(`Deploy setting problem: ${problem}`);
}

if (problems.length > 0) {
  process.exit(1);
}

console.error(
  "Pages deploy settings: API base URL and advertising settings verified.",
);
