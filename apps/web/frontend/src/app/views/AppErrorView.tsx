import { useEffect, useRef } from "react";
import { siteText } from "../site-text";
import { tapTargetClass } from "../styles";

/**
 * Destination for a failure that would otherwise leave no usable page.
 *
 * The frame is repeated here with plain anchors rather than reused from
 * RootLayout, because this screen answers a render that already failed. Reusing
 * router-aware components would depend on the part that may be broken, and a
 * full page load is the right way back after a crash anyway.
 *
 * The thrown error is not shown. It tells a visitor nothing they can act on,
 * and a message written for a log can carry detail that should not be
 * published — the same boundary api-design.md section 4.2 sets for the API.
 */
export const AppErrorView = () => {
  const summaryRef = useRef<HTMLDivElement>(null);

  /*
   * A live region only announces what changes after it is observed, and this
   * one arrives already filled in, so a screen reader may say nothing at all.
   * The crash also replaced the whole page, which leaves focus on a node that
   * no longer exists. Moving focus here answers both, and ui-design.md section
   * 11 allows it when the error is one the visitor must act on.
   */
  useEffect(() => {
    summaryRef.current?.focus();
  }, []);

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
        <div ref={summaryRef} role={"alert"} tabIndex={-1}>
          <h1>{"問題が発生しました"}</h1>
          <p>
            {"画面を表示できませんでした。時間をおいて再度お試しください。"}
          </p>
        </div>
        <a className={tapTargetClass} href={"/"}>
          {siteText.backToGenerator}
        </a>
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
