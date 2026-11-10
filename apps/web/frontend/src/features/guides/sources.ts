import type { GuideSource } from "./types";

/*
 * The Japan Post pages the guides cite. ui-design.md section 5.5 ("Content
 * rules") requires every claim about postal codes to rest on these two, and a
 * claim neither states is not made. The search page is cited only as where a
 * visitor can check a postal code for a mailing.
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
