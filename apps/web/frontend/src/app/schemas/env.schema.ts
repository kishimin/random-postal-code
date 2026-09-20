import { z } from "zod";

export type AppEnv = {
  apiBaseUrl: string;
};

// The URL constructor rather than a pattern: it rejects a bare host:port and a
// relative path the same way a browser would, and it exposes the protocol so a
// non-http scheme cannot slip through.
const isAbsoluteHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().refine(isAbsoluteHttpUrl),
});

/**
 * Validates the build-time environment the application depends on.
 *
 * Takes the environment as an argument rather than reading `import.meta.env`
 * directly, so the rules can be exercised without building the application.
 *
 * Throws instead of falling back to a default. A build that shipped without the
 * variable would otherwise request `undefined/api/random` at runtime, and the
 * first sign of it would be a failed request in a user's browser.
 */
export const parseAppEnv = (env: Record<string, unknown>): AppEnv => {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    throw new Error(
      "VITE_API_BASE_URL must be set to an absolute http or https URL at build time.",
    );
  }

  return { apiBaseUrl: result.data.VITE_API_BASE_URL };
};
