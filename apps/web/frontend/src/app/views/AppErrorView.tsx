import { siteText } from "../site-text";
import { tapTargetClass } from "../styles";
import { AppErrorContent } from "./AppErrorContent";

/**
 * Destination for a failure that left no usable page at all.
 *
 * The frame is repeated here with plain anchors rather than reused from
 * RootLayout, because this screen answers a render that already failed.
 * Reusing router-aware components would depend on the part that may be broken,
 * and a full page load is the right way back after a crash anyway.
 *
 * Used by RootErrorBoundary, which sits outside the router. A route that fails
 * while the layout still renders gets AppErrorContent instead, so the frame
 * appears once rather than twice.
 */
export const AppErrorView = () => {
  return (
    <div className={"flex min-h-dvh flex-col"}>
      <header className={"border-b"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-3"}>
          <a className={tapTargetClass} href={"/"}>
            {siteText.name}
          </a>
        </div>
      </header>

      <main className={"mx-auto w-full max-w-[1200px] flex-1 px-4 py-6"}>
        <AppErrorContent />
      </main>

      <footer className={"border-t"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-4 text-sm"}>
          <p>{siteText.attribution}</p>
          <a className={tapTargetClass} href={"/privacy"}>
            {siteText.privacyLabel}
          </a>
        </div>
      </footer>
    </div>
  );
};
