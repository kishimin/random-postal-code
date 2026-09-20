import { describe, expect, test } from "vitest";
import { createApiClient } from "./api-client";

describe("createApiClient", () => {
  test("resolves a path against the configured base URL", () => {
    const client = createApiClient("https://api.example.com");

    expect(client.resolveUrl("/api/random")).toBe(
      "https://api.example.com/api/random",
    );
  });

  test("keeps a base URL that carries a path prefix", () => {
    // A Worker published under a sub-path would otherwise lose the prefix and
    // request the wrong origin path.
    const client = createApiClient("https://example.com/zipnami/");

    expect(client.resolveUrl("api/random")).toBe(
      "https://example.com/zipnami/api/random",
    );
  });
});
