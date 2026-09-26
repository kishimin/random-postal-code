import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { siteText } from "../site-text";
import { tapTargetClass } from "../styles";

/**
 * Frame shared by every route.
 *
 * The landmarks live here rather than in each screen, so a route added later
 * cannot ship without them. The container is fluid up to the 1200px maximum
 * ui-design.md section 5.1 sets, and its horizontal padding is what keeps
 * content off the edges at a 320px viewport.
 */
export const RootLayout = () => {
  // resolvedLocation, not location: location updates as soon as a navigation
  // starts, before the new route's matches -- and its rendered content --
  // commit. Watching it moved focus to the outgoing screen's heading a
  // moment before it was removed from the document, which silently dropped
  // focus back to the body instead of landing it on the arriving heading.
  const pathname = useRouterState({
    select: (state) => state.resolvedLocation?.pathname,
  });
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef<string>();

  /*
   * Moves focus to the arriving screen's own heading after a client-side
   * route change, so a screen-reader user learns main's content was
   * replaced instead of hearing nothing (Issue #16 AC-5; CR-006 of Issue
   * #10's review).
   *
   * Skipped on the very first render, which covers the initial page load, a
   * direct navigation, and a refresh -- none of which should move focus away
   * from wherever the browser itself put it. The ref tracks the previous
   * pathname rather than a plain "have I run yet" flag, so if this effect
   * ever runs twice for the same navigation (React's development-only
   * double-invoke), the second run sees no change and does nothing, instead
   * of mistaking its own replay for a second navigation.
   */
  useEffect(() => {
    const hasNavigated =
      previousPathname.current !== undefined &&
      previousPathname.current !== pathname;
    previousPathname.current = pathname;

    if (!hasNavigated) return;

    mainRef.current?.querySelector<HTMLElement>("h1")?.focus();
  }, [pathname]);

  return (
    <div className={"flex min-h-dvh flex-col"}>
      <header className={"border-b"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-3"}>
          <Link className={tapTargetClass} to={"/"}>
            {siteText.name}
          </Link>
        </div>
      </header>

      <main
        ref={mainRef}
        className={"mx-auto w-full max-w-[1200px] flex-1 px-4 py-6"}
      >
        <Outlet />
      </main>

      <footer className={"border-t"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-4 text-sm"}>
          <p>{siteText.attribution}</p>
          <Link className={tapTargetClass} to={"/privacy"}>
            {siteText.privacyLabel}
          </Link>
        </div>
      </footer>
    </div>
  );
};
