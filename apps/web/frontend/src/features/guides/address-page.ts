import { japanPostDownload, japanPostReadme } from "./sources";
import type { GuidePage } from "./types";

export const addressPage: GuidePage = {
  path: "/guide/address",
  name: "郵便番号と住所",
  description:
    "一つの郵便番号が複数の住所を指すことや、一つの町域に複数の郵便番号があることを、実際のデータで説明します。",
  lead: "郵便番号と住所は、いつも1対1に対応しているわけではありません。Zipnamiが一つの郵便番号に複数の住所を表示することがあるのは、そのためです。",
  sections: [
    {
      headingId: "address-not-one-to-one-heading",
      heading: "郵便番号と住所は1対1ではない",
      paragraphs: [
        "日本郵便の郵便番号データには、「一つの郵便番号で二以上の町域を表す場合」と「一町域が二以上の郵便番号で表される場合」を示す欄があります。一つの番号が複数の町を指すことも、一つの町が複数の番号に分かれることも、どちらも珍しくありません。",
      ],
    },
    {
      headingId: "address-many-addresses-heading",
      heading: "一つの郵便番号が複数の住所を指す",
      paragraphs: [
        "Zipnamiが使っているデータでは、120,721件の郵便番号のうち1,338件が、2件以上の住所に対応しています。Zipnamiは、選んだ郵便番号に対応する住所を省略せずにすべて表示します。",
        "たとえば 498-0000 は、愛知県弥富市と三重県桑名郡木曽岬町の両方に対応しています。一つの郵便番号が県境をまたいでいる例です。",
      ],
    },
    {
      headingId: "address-not-listed-heading",
      heading: "「以下に掲載がない場合」の郵便番号",
      paragraphs: [
        "市区町村の中には、ほかの郵便番号に載っていない地域のための郵便番号があります。日本郵便のデータでは、その町域の欄に「以下に掲載がない場合」と書かれています。探している町域がデータに載っていないときに使う番号です。",
        "これは町の名前ではないため、Zipnamiでは市区町村までの住所として表示します。たとえば 340-0000 は「埼玉県草加市」と表示されます。",
      ],
    },
    {
      headingId: "address-within-town-heading",
      heading: "町域の中での分かれ方",
      paragraphs: [
        "東京都中央区八重洲のように、丁目ごとに郵便番号が分かれる町域があります。また、小字ごとに番地が付けられている町域では、町域名と番地だけでは住所が一つに決まらないことがあり、日本郵便のデータにはそれを示す欄があります。",
      ],
    },
    {
      headingId: "address-map-heading",
      heading: "地図に表示される場所",
      paragraphs: [
        "Zipnamiの地図は、住所の文字列でGoogle マップを検索して表示しています。地図に示される地点は、その郵便番号が指す範囲の全体を表すものではありません。",
      ],
    },
  ],
  sources: [japanPostReadme, japanPostDownload],
};
