import type { GuideSource } from "./types";

/*
 * The official pages the guides cite. ui-design.md section 5.5 ("Content
 * rules") allows only these: Japan Post's own pages and 総務省's code
 * specification. A claim none of them states is not made. Each guide lists
 * the ones its claims rest on, so a reader can check a claim against the page
 * it came from.
 */
export const japanPostReadme: GuideSource = {
  label: "日本郵便「郵便番号データの説明」（KEN_ALL.CSV の各項目の説明）",
  href: "https://www.post.japanpost.jp/service/search/zipcode/download/readme.html",
};

export const japanPostDownload: GuideSource = {
  label: "日本郵便「郵便番号データダウンロード」",
  href: "https://www.post.japanpost.jp/service/search/zipcode/download/",
};

export const japanPostSearch: GuideSource = {
  label: "日本郵便「郵便番号検索」",
  href: "https://www.post.japanpost.jp/service/search/zipcode/",
};

export const japanPostOfficeReadme: GuideSource = {
  label: "日本郵便「大口事業所個別番号データの説明」",
  href: "https://www.post.japanpost.jp/service/search/zipcode/download/office/readme.html",
};

export const japanPostOfficeDownload: GuideSource = {
  label: "日本郵便「事業所の個別郵便番号のダウンロード」",
  href: "https://www.post.japanpost.jp/service/search/zipcode/download/office/index-zip.html",
};

export const japanPostAddressOmission: GuideSource = {
  label: "日本郵便「住所の記載省略は、どのようにすればいいのですか？」",
  href: "https://www.post.japanpost.jp/question/35.html",
};

/*
 * The pages of Japan Post's 郵便番号・バーコードマニュアル each guide relies
 * on, cited one by one rather than as the manual's index, so a claim leads to
 * the page that states it.
 */
const zipManual =
  "https://www.post.japanpost.jp/service/search/zipcode/zipmanual";

export const zipManualPurpose: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル 郵便番号制の目的」",
  href: `${zipManual}/p03.html`,
};

export const zipManualCodes: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル 郵便番号」",
  href: `${zipManual}/p04.html`,
};

export const zipManualCodeBox: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル 郵便番号枠」",
  href: `${zipManual}/p05.html`,
};

export const zipManualProcessing: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル 郵便番号による郵便物処理」",
  href: `${zipManual}/p06.html`,
};

export const zipManualBarcodeKinds: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル バーコード(1/4)」",
  href: `${zipManual}/p10.html`,
};

export const zipManualBarcodeShape: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル バーコード(2/4)」",
  href: `${zipManual}/p11.html`,
};

export const zipManualBarcodeFormat: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル バーコード(3/4)」",
  href: `${zipManual}/p12.html`,
};

export const zipManualBarcodePrinting: GuideSource = {
  label: "日本郵便「郵便番号・バーコードマニュアル バーコード(4/4)」",
  href: `${zipManual}/p13.html`,
};

export const zipManualExtractionOverview: GuideSource = {
  label:
    "日本郵便「郵便番号・バーコードマニュアル バーコードに必要な文字情報の抜き出し法(1/9)」",
  href: `${zipManual}/p17.html`,
};

export const zipManualExtractionAddress: GuideSource = {
  label:
    "日本郵便「郵便番号・バーコードマニュアル バーコードに必要な文字情報の抜き出し法(2/9)」",
  href: `${zipManual}/p18.html`,
};

export const zipManualExtractionRules: GuideSource = {
  label:
    "日本郵便「郵便番号・バーコードマニュアル バーコードに必要な文字情報の抜き出し法(3/9)」",
  href: `${zipManual}/p19.html`,
};

export const zipManualExtractionJoin: GuideSource = {
  label:
    "日本郵便「郵便番号・バーコードマニュアル バーコードに必要な文字情報の抜き出し法(4/9)」",
  href: `${zipManual}/p20.html`,
};

export const soumuCodeSpecification: GuideSource = {
  label: "総務省「全国地方公共団体コード仕様」",
  href: "https://www.soumu.go.jp/main_content/000137948.pdf",
};
