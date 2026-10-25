const EXACT_ORIGIN_REQUIRED =
  "ALLOWED_ORIGINS must be exactly one https origin, such as https://<project>.pages.dev";

const isExactHttpsOrigin = (value: string): boolean => {
  if (!URL.canParse(value)) return false;

  const url = new URL(value);

  // Comparing against the parsed origin rejects a path, a trailing slash, a
  // query, and credentials in one check. A wildcard host survives parsing
  // (`https://*.pages.dev` is a syntactically valid URL), so it is refused
  // by name: the CORS middleware matches origins verbatim and would never
  // match it, leaving the production site unable to call the API.
  return (
    url.protocol === "https:" && url.origin === value && !value.includes("*")
  );
};

/**
 * What is wrong with the `ALLOWED_ORIGINS` a production deploy is about to
 * set, as messages that name the setting but never repeat its value (deploy
 * logs are shared, and design.md section 10 forbids printing secrets there).
 *
 * Production serves one Pages origin, so exactly one exact https origin is
 * required. The CORS middleware itself tolerates a list and silently drops
 * `*`; this check exists so a deploy fails loudly instead of shipping an
 * allowlist that quietly authorizes nothing.
 */
export const problemsWithAllowedOrigins = (
  value: string | undefined,
): string[] => {
  const trimmed = value?.trim() ?? "";

  if (trimmed === "") return ["ALLOWED_ORIGINS is not set"];

  return isExactHttpsOrigin(trimmed) ? [] : [EXACT_ORIGIN_REQUIRED];
};
