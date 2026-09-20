import { Outlet } from "@tanstack/react-router";

/**
 * Frame shared by every route.
 *
 * The main landmark lives here rather than in each screen, so a route added
 * later cannot ship without one. The container is fluid up to the 1200px
 * maximum ui-design.md section 5.1 sets, and its horizontal padding is what
 * keeps content off the edges at a 320px viewport.
 */
export const RootLayout = () => {
  return (
    <main className={"mx-auto w-full max-w-[1200px] px-4 py-6"}>
      <Outlet />
    </main>
  );
};
