import { Link, Outlet } from "@tanstack/react-router";
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
  return (
    <div className={"flex min-h-dvh flex-col"}>
      <header className={"border-b"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-3"}>
          <Link className={tapTargetClass} to={"/"}>
            {siteText.name}
          </Link>
        </div>
      </header>

      <main className={"mx-auto w-full max-w-[1200px] flex-1 px-4 py-6"}>
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
