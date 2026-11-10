import { japanPostDownload, japanPostReadme } from "./sources";
import type { GuidePage } from "./types";

export const dataPage: GuidePage = {
  path: "/guide/data",
  name: "データについて",
  description:
    "Zipnamiが使う郵便番号データの出典、取得日、件数、加工のしかた、わかっている制限を説明します。",
  lead: "Zipnamiに表示される郵便番号と住所は、すべて日本郵便が公開しているデータから作っています。どのデータを、いつ取得し、どのように加工しているかを説明します。",
  sections: [
    {
      headingId: "data-source-heading",
      heading: "出典",
      paragraphs: [
        "日本郵便株式会社が公開している、住所の郵便番号の全国一括データ（KEN_ALL.CSV）を使っています。日本郵便は、郵便番号データについて著作権を主張しないとしています。",
      ],
    },
    {
      headingId: "data-retrieval-heading",
      heading: "取得日と件数",
      paragraphs: [
        "現在のデータは、2026年11月3日に日本郵便のサイトから取得したものです。",
        "取得したデータは124,841行で、Zipnamiではこれを120,721件の郵便番号と124,526件の住所にまとめています。そのうち、2件以上の住所に対応する郵便番号は1,338件です。",
      ],
    },
    {
      headingId: "data-update-heading",
      heading: "更新のしかた",
      paragraphs: [
        "Zipnamiのデータは自動では更新されません。日本郵便のサイトからデータを取得し直して変換し直したときにだけ、新しいデータに入れ替わります。決まった更新日はありません。",
        "日本郵便の郵便番号データの説明には、全国一括のデータのほかに、更新年月ごとの追加分と削除分のデータ（ADD_YYMM.ZIP、DEL_YYMM.ZIP）についての記載があります。",
      ],
    },
    {
      headingId: "data-transformation-heading",
      heading: "加工のしかた",
      paragraphs: ["日本郵便のデータを、次のように変換して使っています。"],
      items: [
        "住所は、都道府県・市区町村・町域の漢字の欄から作ります。読み仮名の欄は使いません。",
        "町域名が長く、データの中で複数の行に分かれているものは、1件の町域名につなぎ直します。",
        "同じ郵便番号で、都道府県・市区町村・町域がすべて同じ行は、1件の住所にまとめます。",
        "「以下に掲載がない場合」や「…の次に番地がくる場合」は町の名前ではないため、町域を空にして、市区町村までの住所にします。",
        "「（次のビルを除く）」や「（地階・階層不明）」が付いた町域は、括弧の前の名前だけを残します。",
      ],
    },
    {
      headingId: "data-limitations-heading",
      heading: "わかっている制限",
      paragraphs: [],
      items: [
        "取得日のあとに日本郵便が行った変更は、データを入れ替えるまで反映されません。",
        "大口の事業所や私書箱などの個別の郵便番号は含みません。",
        "「（丁目）」や番地の範囲など、上に書いたもの以外の括弧書きは、日本郵便のデータのまま表示されます。",
      ],
    },
  ],
  sources: [japanPostDownload, japanPostReadme],
};
