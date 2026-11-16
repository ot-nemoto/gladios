# CLAUDE.md

作業前に `README.md` を読むこと（設計書の場所、進め方の約束、ディレクトリ構成、実装の約束がある）。

## 作業の流れ（必ず守る）

規則の正は README の「作業の流れ（Issue・ブランチ・PR）」。以下はその要点で、README を変えるときはここも合わせて直す。

1. 作業単位ごとに GitHub Issue を先に作る（`gh issue create`）。目的・作業内容・完了条件を書く。
2. `develop` から `<種類>/<Issue番号>-<短い説明>` のブランチを切る（種類は feature / fix / docs / chore / refactor）。
3. コミットメッセージに `(#Issue番号)` を入れる。
4. PR は `develop` 向けに作り、本文に `Closes #Issue番号` で対応 Issue をすべて書く。
5. PR を作成したら `/code-review high <PR番号>` でエージェントレビューを行う（develop → master の自動 PR と Dependabot の npm 更新は対象外）。
   - 指摘は「直す（PR が入れた問題）／Issue にする（既存・範囲外）／不採用（理由を書く）」で対応し、結果を PR にまとめのコメントで残す。
   - 「直す」で変更したら再レビューは 1 回だけ。その修正で入った問題だけを見る。さらに直したらユーザーの確認を受ける。
6. マージはマージコミットで（squash しない）。レビュー対象の PR は、レビュー・結果のコメント・CI が済んでから。
7. 作業中に見つけた別件はその場で直さず、新しい Issue にする。

## 確認

- 変更後は `npm run typecheck` と `npm test` を通す。
- `src/sim/` の判定を変える場合は、Python 試作（`docs/prototype/sim_prototype.py`）を先に直し、`npm run golden` で正解データを作り直してから TS を合わせる。
