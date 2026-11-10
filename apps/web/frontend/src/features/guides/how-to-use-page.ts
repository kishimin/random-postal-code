import { japanPostDownload } from "./sources";
import type { GuidePage } from "./types";

export const howToUsePage: GuidePage = {
  path: "/guide/how-to-use",
  name: "使い方",
  description:
    "Zipnamiで郵便番号を生成し、住所と地図を確かめ、コピーし、履歴から見直すまでの使い方を説明します。",
  lead: "Zipnamiの使い方を、郵便番号を生成するところから順に説明します。会員登録などは必要ありません。",
  sections: [
    {
      headingId: "how-to-generate-heading",
      heading: "郵便番号を生成する",
      paragraphs: [
        "トップページの「ランダム生成する」を押すと、郵便番号を1つ選んで表示します。別の郵便番号を選ぶときは「もう一度、波に乗る」を押します。",
        "通信に失敗したときは、その旨が表示され、ボタンが「再試行する」に変わります。それまでに表示していた結果は、そのまま残ります。",
      ],
    },
    {
      headingId: "how-to-addresses-heading",
      heading: "住所を確かめる",
      paragraphs: [
        "郵便番号の下に、その番号に対応する住所がすべて並びます。いくつの住所に対応しているかは、「対応する住所 N件」の表示で確かめられます。郵便番号と住所の関係については、「郵便番号と住所」のガイドで説明しています。",
      ],
    },
    {
      headingId: "how-to-map-heading",
      heading: "地図で見る",
      paragraphs: [
        "住所ごとの「地図に表示」を押すと、地図がその住所に切り替わります。最初は、1件目の住所が地図に表示されます。",
        "「Google マップで開く」を押すと、その住所でGoogle マップを開きます。地図を読み込めないときも、郵便番号と住所はそのまま使えます。",
      ],
    },
    {
      headingId: "how-to-copy-heading",
      heading: "郵便番号をコピーする",
      paragraphs: [
        "「郵便番号をコピー」を押すと、郵便番号をコピーします。画面にはハイフン付きで表示されますが、コピーされるのはハイフンを含まない7桁の数字です。",
      ],
    },
    {
      headingId: "how-to-history-heading",
      heading: "履歴から見直す",
      paragraphs: [
        "生成した郵便番号は、お使いのブラウザに新しい順で最大20件まで残ります。「履歴を展開」を押すと一覧が開き、それぞれの郵便番号と住所を見られます。",
        "履歴はお使いのブラウザの中にだけ保存し、サーバーには送信しません。ブラウザに保存されたサイトのデータを消すと、履歴も消えます。",
      ],
    },
  ],
  sources: [japanPostDownload],
};
