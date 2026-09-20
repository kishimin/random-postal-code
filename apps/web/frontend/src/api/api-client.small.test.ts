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

  test("keeps the prefix when the base omits the trailing slash", () => {
    // Without normalization new URL() reads `zipnami` as a file name and drops
    // it, so this is the case the normalization exists for.
    const client = createApiClient("https://example.com/zipnami");

    expect(client.resolveUrl("/api/random")).toBe(
      "https://example.com/zipnami/api/random",
    );
  });

  test("keeps the prefix when the path is written with a leading slash", () => {
    const client = createApiClient("https://example.com/zipnami/");

    expect(client.resolveUrl("/api/random")).toBe(
      "https://example.com/zipnami/api/random",
    );
  });

  test("resolves a protocol-relative path against the configured base", () => {
    // `//api/random` would otherwise be read as a host, sending the request to
    // https://api/random and losing the prefix with it.
    const client = createApiClient("https://example.com/zipnami/");

    expect(client.resolveUrl("//api/random")).toBe(
      "https://example.com/zipnami/api/random",
    );
  });

  test("ignores a query or fragment written into the base URL", () => {
    // Appending a slash to the raw string would put it after the query, so the
    // prefix disappeared and every request carried the query along.
    const client = createApiClient("https://example.com/zipnami?debug=1#top");

    expect(client.resolveUrl("/api/random")).toBe(
      "https://example.com/zipnami/api/random",
    );
  });
});
