import { japanPostDownload, japanPostReadme, japanPostSearch } from "./sources";
import type { GuidePage } from "./types";

export const postalCodePage: GuidePage = {
  path: "/guide/postal-code",
  name: "郵便番号のしくみ",
  description:
    "日本の郵便番号が何を単位に付けられているのかを、日本郵便の資料と実際の郵便番号の例で説明します。",
  lead: "郵便番号は、住所のどこまでを表しているのでしょうか。日本郵便が公開している郵便番号データの説明と、実際のデータにある例をもとに見ていきます。",
  sections: [
    {
      headingId: "postal-code-digits-heading",
      heading: "住所の郵便番号は7桁",
      paragraphs: [
        "日本郵便が公開している郵便番号データでは、住所の郵便番号は7桁の数字で書かれています。同じデータには、7桁の番号と並んで「旧郵便番号（5桁）」の欄もあります。",
        "Zipnamiでは読みやすいように、「100-0001」のように前の3桁と後ろの4桁の間にハイフンを入れて表示します。「郵便番号をコピー」でコピーされるのは、ハイフンを含まない7桁の数字です。",
      ],
    },
    {
      headingId: "postal-code-town-heading",
      heading: "郵便番号は町域ごとに付けられる",
      paragraphs: [
        "日本郵便の説明では、郵便番号は原則として町域（丁目を除いた町の名前の単位）ごとに付けられていて、小字や通称ごとには付けられていません。",
        "たとえば、東京都千代田区千代田の郵便番号は 100-0001 です。",
      ],
    },
    {
      headingId: "postal-code-split-heading",
      heading: "一つの町域に複数の郵便番号があることも",
      paragraphs: [
        "丁目や番地によって郵便番号が分かれている町域もあります。日本郵便のデータには、こうした町域を示すための欄（一町域が二以上の郵便番号で表される場合の表示）があります。",
        "たとえば、東京都中央区八重洲は、1丁目が 103-0028、2丁目が 104-0028 です。同じ町名でも、前の3桁から違うことがあります。",
      ],
    },
    {
      headingId: "postal-code-building-heading",
      heading: "ビルの階ごとの郵便番号",
      paragraphs: [
        "データには、一つのビルの階ごとに別の郵便番号が付けられている例もあります。",
        "たとえば、東京都千代田区の霞が関ビルは、1階が 100-6001、2階が 100-6002 です。地階の場合や階がわからない場合には 100-6090 を使います。",
      ],
    },
    {
      headingId: "postal-code-business-heading",
      heading: "事業所や私書箱の個別の郵便番号",
      paragraphs: [
        "大口の事業所や私書箱、料金受取人払には、住所とは別に個別の郵便番号が付けられています。これらは住所の郵便番号データには含まれていないため、Zipnamiにも出てきません。日本郵便は、事業所の個別郵便番号を別のデータとして公開しています。",
      ],
    },
  ],
  sources: [japanPostReadme, japanPostDownload, japanPostSearch],
};
