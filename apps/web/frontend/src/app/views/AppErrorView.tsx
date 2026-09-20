import { siteText } from "../site-text";

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
  return (
    <div className={"flex min-h-dvh flex-col"}>
      <header className={"border-b"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-3"}>
          <a href={"/"}>{siteText.name}</a>
        </div>
      </header>

      <main className={"mx-auto w-full max-w-[1200px] flex-1 px-4 py-6"}>
        <div role={"alert"}>
          <h1>{"問題が発生しました"}</h1>
          <p>
            {"画面を表示できませんでした。時間をおいて再度お試しください。"}
          </p>
        </div>
        <a href={"/"}>{siteText.backToGenerator}</a>
      </main>

      <footer className={"border-t"}>
        <div className={"mx-auto w-full max-w-[1200px] px-4 py-4 text-sm"}>
          <p>{siteText.attribution}</p>
          <a href={"/privacy"}>{siteText.privacyLabel}</a>
        </div>
      </footer>
    </div>
  );
};
