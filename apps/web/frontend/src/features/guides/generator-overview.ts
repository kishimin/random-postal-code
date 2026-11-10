import { guidePages } from "./guide-pages";

/** One of the three things the overview says Zipnami does. */
type Capability = {
  readonly title: string;
  readonly body: string;
};

/*
 * The copy of the sections that follow the generator's start card while no
 * result is shown (ui-design.md section 5.5). The three capabilities are the
 * ones the guides explain: drawing a postal code at random, seeing every
 * address it covers with a map, and copying it and finding it again in the
 * browser-local history.
 */
export const generatorOverview = {
  capabilitiesHeading: "Zipnamiでできること",
  capabilities: [
    {
      title: "郵便番号をランダムに選ぶ",
      body: "日本郵便のデータにある郵便番号から、1つを同じ確率で選びます。",
    },
    {
      title: "住所と地図で確かめる",
      body: "選んだ郵便番号に対応する住所をすべて表示し、地図で場所を確かめられます。",
    },
    {
      title: "コピーして履歴から見直す",
      body: "郵便番号をコピーでき、生成した結果はお使いのブラウザに最大20件残ります。",
    },
  ] satisfies readonly Capability[],
  learnMoreHeading: "郵便番号をもっと知る",
} as const;

/**
 * The four guides the overview links, each by its own name. サイトについて is
 * left to the footer: the overview is about learning more about postal codes.
 */
export const learnMoreGuides = guidePages.filter(
  (page) => page.path !== "/about",
);
