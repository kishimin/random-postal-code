import { describe, expect, test } from "vitest";
import { pagesFileFor } from "./pages-routing";

const built = new Set([
  "/index.html",
  "/about.html",
  "/guide/data.html",
  "/404.html",
  "/assets/index-abc.js",
  "/docs/index.html",
]);
const isBuilt = (file: string) => built.has(file);

// How Cloudflare Pages answers a request for a static build, which `vite
// preview` has to imitate so a test of the preview tests what Pages serves.
describe("pagesFileFor", () => {
  test("serves the root from index.html", () => {
    expect(pagesFileFor("/", isBuilt)).toBe("/index.html");
  });

  test("serves a file that exists as it is", () => {
    expect(pagesFileFor("/assets/index-abc.js", isBuilt)).toBe(
      "/assets/index-abc.js",
    );
  });

  // Pages serves /about from about.html without a redirect.
  test("serves a route from its .html file", () => {
    expect(pagesFileFor("/about", isBuilt)).toBe("/about.html");
    expect(pagesFileFor("/guide/data", isBuilt)).toBe("/guide/data.html");
  });

  test("serves a directory from its index.html", () => {
    expect(pagesFileFor("/docs", isBuilt)).toBe("/docs/index.html");
  });

  test.each([
    "/nonexistent",
    "/guide",
    "/about.html.map",
    "/assets/missing.js",
  ])("finds no file for %s, so the caller answers 404", (pathname) => {
    expect(pagesFileFor(pathname, isBuilt)).toBeNull();
  });

  test("never leaves the build directory", () => {
    expect(pagesFileFor("/../package.json", () => true)).toBeNull();
    expect(pagesFileFor("/guide/../../x", () => true)).toBeNull();
  });
});
