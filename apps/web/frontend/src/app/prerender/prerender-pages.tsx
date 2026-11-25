import { createMemoryHistory } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import {
  contentRoutePaths,
  pageMetadataFor,
  type PageMetadata,
} from "../page-metadata";
import { createAppRouter } from "../routes/app-router";
import { App } from "../views/App";

/** One file the build writes for Cloudflare Pages to serve. */
export type PrerenderedPage = {
  /** The file's path inside the build, such as `guide/data.html`. */
  readonly file: string;
  /** The route the file answers, or null for the not-found page. */
  readonly path: string | null;
  /** The application's markup, for the root element. */
  readonly body: string;
  readonly metadata: PageMetadata;
};

// A path no route claims, so the router renders its not-found screen.
const NOT_FOUND_PATH = "/not-found";
const NOT_FOUND_FILE = "404.html";

/*
 * `<route>.html`, not `<route>/index.html`: Pages serves /about from about.html
 * as it is, but redirects /about to /about/ for about/index.html, and a
 * crawler would follow that redirect on every page.
 */
const fileOf = (path: string) =>
  path === "/" ? "index.html" : `${path.slice(1)}.html`;

const renderAt = async (path: string) => {
  const router = createAppRouter(
    createMemoryHistory({ initialEntries: [path] }),
  );
  await router.load();

  return renderToString(<App router={router} />);
};

/**
 * Renders every content route, and the not-found screen, through the
 * production router.
 *
 * One at a time: each render builds its own router, and a failure should name
 * the route it came from instead of the one that lost a race.
 */
export const buildPages = async (): Promise<PrerenderedPage[]> => {
  const pages: PrerenderedPage[] = [];

  for (const path of contentRoutePaths) {
    pages.push({
      file: fileOf(path),
      path,
      body: await renderAt(path),
      metadata: pageMetadataFor(path),
    });
  }
  pages.push({
    file: NOT_FOUND_FILE,
    path: null,
    body: await renderAt(NOT_FOUND_PATH),
    metadata: pageMetadataFor(NOT_FOUND_PATH),
  });

  return pages;
};
