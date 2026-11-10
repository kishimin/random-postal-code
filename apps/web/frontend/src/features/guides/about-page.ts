import { japanPostDownload, japanPostReadme, japanPostSearch } from "./sources";
import type { GuidePage } from "./types";

export const aboutPage: GuidePage = {
  path: "/about",
  name: "サイトについて",
  description:
    "Zipnamiは、日本の郵便番号をランダムに1つ選び、その番号に対応するすべての住所と地図を表示するWebサイトです。",
  lead: "Zipnami（ジップナミ）は、日本の郵便番号をランダムに1つ選び、その番号がどこを指しているのかを確かめるためのWebサイトです。",
  sections: [
    {
      headingId: "about-features-heading",
      heading: "このサイトでできること",
      paragraphs: [],
      items: [
        "ボタンを押すと、日本郵便が公開している郵便番号データから郵便番号を1つ選びます。どの郵便番号も同じ確率で選ばれます。",
        "選ばれた郵便番号に対応する住所をすべて表示します。住所ごとに、地図への表示とGoogle マップで開くリンクを用意しています。",
        "郵便番号はボタン1つでコピーできます。生成した郵便番号は、お使いのブラウザに最大20件まで履歴として残ります。",
      ],
    },
    {
      headingId: "about-purpose-heading",
      heading: "このサイトを作った理由",
      paragraphs: [
        "郵便番号は、郵便物を届けるために町域ごとに付けられた番号です。ふだん目にするのは自分や相手の住所の番号くらいですが、番号の一つひとつの先には、まだ知らない町があります。",
        "Zipnamiは、目的地を決めずに郵便番号を1つ引き、その番号がどの町を指しているのかを住所と地図で確かめる、小さな寄り道のために作りました。郵便番号のしくみや、郵便番号と住所の関係についても、このサイトのガイドで説明しています。",
      ],
    },
    {
      headingId: "about-limitations-heading",
      heading: "できないこと・注意していただきたいこと",
      paragraphs: [],
      items: [
        "郵便番号のデータは、日本郵便のサイトから取得した時点のものです。取得したあとに変わった郵便番号は反映されていません。郵便物の宛先を確かめるときは、日本郵便の郵便番号検索をご利用ください。",
        "大口の事業所や私書箱に付けられた個別の郵便番号は含みません。日本郵便は、これらを住所の郵便番号とは別のデータとして公開しています。",
        "表示する住所は町域までです。番地や建物の部屋までは表しません。",
        "地図にはGoogle マップを利用しています。地図を読み込めないときも、郵便番号と住所はそのまま使えます。",
        "履歴はお使いのブラウザの中にだけ保存し、サーバーには送信しません。",
      ],
    },
    {
      headingId: "about-related-heading",
      heading: "関連するページ",
      paragraphs: [
        "このサイトの個人情報の扱いと、データの出典や取得日については、次のページにまとめています。",
      ],
      links: [
        { label: "プライバシーポリシー", to: "/privacy" },
        { label: "データについて", to: "/guide/data" },
      ],
    },
  ],
  sources: [japanPostDownload, japanPostReadme, japanPostSearch],
};
