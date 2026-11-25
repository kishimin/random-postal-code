import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { canonicalUrlOf } from "../deployment/site-origin";
import {
  contentRoutePaths,
  pageMetadataFor,
  siteDescription,
} from "../page-metadata";
import { createAppRouter } from "../routes/app-router";

/*
 * The prerendered HTML names the page it was rendered for, and the client
 * starts from that head. Whichever screen the visitor reaches next has to
 * describe itself there, or a refresh of /about followed by a click to the
 * privacy page would leave /about's description and canonical URL on it
 * (Issue #169). Rendered through the production route configuration
 * (ADR-0011).
 */
const shippedHead = {
  description: "the description the landing page shipped with",
  canonical: "https://zipnami.pages.dev/landed-elsewhere",
};

const addShippedHead = () => {
  const description = document.createElement("meta");
  description.name = "description";
  description.content = shippedHead.description;
  const canonical = document.createElement("link");
  canonical.rel = "canonical";
  canonical.href = shippedHead.canonical;
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex";
  document.head.append(description, canonical, robots);
};

const headElements = <Element extends HTMLElement>(selector: string) =>
  // eslint-disable-next-line testing-library/no-node-access -- a meta or link tag is not in the accessibility tree, and what a crawler reads is exactly these tags
  [...document.head.querySelectorAll<Element>(selector)];

const descriptions = () =>
  headElements<HTMLMetaElement>('meta[name="description"]').map(
    (meta) => meta.content,
  );

const canonicalUrls = () =>
  headElements<HTMLLinkElement>('link[rel="canonical"]').map(
    (link) => link.href,
  );

const robotsDirectives = () =>
  headElements<HTMLMetaElement>('meta[name="robots"]').map(
    (meta) => meta.content,
  );

const renderAt = (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );

  return { router, ...render(<RouterProvider router={router} />) };
};

const goTo = async (
  router: ReturnType<typeof createAppRouter>,
  path: string,
) => {
  await act(() => Promise.resolve(router.history.push(path)));
};

beforeEach(() => {
  addShippedHead();
});

afterEach(() => {
  for (const element of headElements(
    'meta[name="description"], link[rel="canonical"], meta[name="robots"]',
  )) {
    element.remove();
  }
});

describe("the head follows the screen shown", () => {
  test.each(contentRoutePaths)(
    "%s names its own description and canonical URL, replacing the ones it started with",
    async (path) => {
      renderAt(path);
      await screen.findByRole("heading", { level: 1 });

      await waitFor(() => {
        expect(descriptions()).toEqual([pageMetadataFor(path).description]);
      });
      expect(canonicalUrls()).toEqual([canonicalUrlOf(path)]);
    },
  );

  test("navigating from a guide to the privacy page moves the description and the canonical URL with it", async () => {
    const { router } = renderAt("/about");
    await screen.findByRole("heading", { level: 1 });

    await goTo(router, "/privacy");

    await waitFor(() => {
      expect(descriptions()).toEqual([pageMetadataFor("/privacy").description]);
    });
    expect(canonicalUrls()).toEqual([canonicalUrlOf("/privacy")]);
  });

  test("leaving a guide for the home page restores the site's default description", async () => {
    const { router } = renderAt("/guide/data");
    await screen.findByRole("heading", { level: 1 });

    await goTo(router, "/");

    await waitFor(() => {
      expect(descriptions()).toEqual([siteDescription]);
    });
    expect(canonicalUrls()).toEqual([canonicalUrlOf("/")]);
  });

  // 404.html ships noindex; a visitor who lands there and follows a link to a
  // real page must not leave that page asking to be left out of the index.
  test.each(contentRoutePaths)(
    "%s drops the noindex the not-found page shipped with",
    async (path) => {
      renderAt(path);
      await screen.findByRole("heading", { level: 1 });

      await waitFor(() => {
        expect(robotsDirectives()).toEqual([]);
      });
    },
  );

  test("a path no route claims keeps no canonical URL and the site's default description", async () => {
    const { router } = renderAt("/about");
    await screen.findByRole("heading", { level: 1 });

    await goTo(router, "/nonexistent");

    await waitFor(() => {
      expect(canonicalUrls()).toEqual([]);
    });
    expect(descriptions()).toEqual([siteDescription]);
  });
});
