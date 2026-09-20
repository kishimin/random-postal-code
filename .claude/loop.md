ATDDサイクルを中断地点から再開する。**確認を求めて待たない。**

このプロンプトは `/loop` または定期タスクから無人で起動される。判断を仰ぐために停止すると、
次の起動まで何も進まない。判断に詰まったら次の順で扱う。

1. `decision-agent` へ尋ねる。資料に書かれていれば、その答えと出典で進む
2. 先例しか無ければ、先例に従って進み、前提として記録する
3. どこにも書かれていなければ、`defer-decision` Skill に従い、**質問をIssueへ残し
   `needs-decision` ラベルを付けて、別のIssueへ移る**

Issueを選ぶときは `needs-decision` ラベルの付いたものを除外する。ただし、そのIssueに
ループの質問より新しいコメントがあれば回答が来ている。`defer-decision` の手順4で再開する。

## 1. 現在地を調べる

会話履歴ではなくリポジトリとIssueの状態から判断する。

- `gh issue list --state open --json number,title` で対象Issueを確認する
- `git branch --show-current` と `git log --oneline -5` で進行中の作業を見る
- `git log --oneline -3 -- acceptance/` でAcceptance Testが確定済みかを見る

受け入れ条件の正はIssue本文である（`CLAUDE.md` を参照）。`docs/ACCEPTANCE.md` は存在せず、
作る必要もない。

## 2. 状態に応じて1手だけ進める

| 状態                     | 次の1手                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| 進行中のIssueが無い      | open Issueから依存の解けているものを1件選び、作業ブランチを作る                               |
| ATが未作成               | そのIssueのATを `acceptance/` へ書き、未実装が理由で失敗することを確認して `test:` で確定する |
| ATが確定済みで実装が未完 | Red → Green → Refactor を1項目進め、各段でコミットする                                        |
| ATがGreen                | 検証を全て実行し、Issueのチェックボックスを更新する                                           |

1回の起動で複数のIssueへ手を広げない。

## 3. 完了条件

そのIssueについて次が揃ったら、チェックボックスを更新して次の起動へ渡す。

- Acceptance TestがGreen
- `bun run lint`、`bun run typecheck`、`bun run format:check`、`bun run test:coverage:pr` が成功
- `git status --porcelain -- acceptance/` が空

**検証は実際にコマンドを実行し、その出力を残す。** 通ったと述べるだけにしない。

## 守ること

- 実装フェーズで `acceptance/` を変更しない
- Issue本文の `## Out of scope` をATで検証しない
- 受け入れ条件が不足していてATを書けない場合は、推測で埋めずに報告して終える
- 作業ブランチはpushする。`main` への直接pushとマージは行わない（`CLAUDE.md` の `### push`）

進捗が無いまま同じ状態を繰り返した場合は、その旨を報告してループを止める。
