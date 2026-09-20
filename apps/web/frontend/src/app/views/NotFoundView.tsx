import { Link } from "@tanstack/react-router";
import { siteText } from "../site-text";
import { tapTargetClass } from "../styles";

/**
 * Destination for a path no route claims.
 *
 * Reached through the router rather than the server: Pages answers every path
 * with index.html, so the router is what distinguishes a mistyped address from
 * a real one.
 */
export const NotFoundView = () => {
  return (
    <>
      <h1>{"ページが見つかりません"}</h1>
      <p>
        {"お探しのページは移動したか、アドレスが誤っている可能性があります。"}
      </p>
      <Link className={tapTargetClass} to={"/"}>
        {siteText.backToGenerator}
      </Link>
    </>
  );
};
