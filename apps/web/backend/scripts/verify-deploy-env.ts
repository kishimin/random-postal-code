/*
 * Checks the settings a production Worker deploy is about to use, before
 * `wrangler deploy` runs, and fails the deploy when one is unusable. It
 * names each problem setting but never prints a value (design.md section
 * 10: "Do not print secrets in deployment logs").
 *
 * Usage: ALLOWED_ORIGINS=https://<project>.pages.dev bun run verify:deploy-env
 */
import { problemsWithAllowedOrigins } from "../src/deployment/deploy-settings.ts";

const problems = problemsWithAllowedOrigins(process.env.ALLOWED_ORIGINS);

for (const problem of problems) {
  console.error(`Deploy setting problem: ${problem}`);
}

if (problems.length > 0) {
  process.exit(1);
}

console.error("Worker deploy settings: ALLOWED_ORIGINS verified.");
