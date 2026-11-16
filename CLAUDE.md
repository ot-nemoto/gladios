# CLAUDE.md

作業前に `README.md` を読むこと（設計書の場所、進め方の約束、ディレクトリ構成、実装の約束がある）。

## 作業の流れ（必ず守る）

README の「作業の流れ（Issue・ブランチ・PR）」に従う。要点:

1. 作業単位ごとに GitHub Issue を先に作る（`gh issue create`）。目的・作業内容・完了条件を書く。
2. `develop` から `<種類>/<Issue番号>-<短い説明>` のブランチを切る。
3. コミットメッセージに `(#Issue番号)` を入れる。
4. PR は `develop` 向けに作り、本文に `Closes #Issue番号` で対応 Issue をすべて書く。
5. 作業中に見つけた別件はその場で直さず、新しい Issue にする。

## 確認

- 変更後は `npm run typecheck` と `npm test` を通す。
- `src/sim/` の判定を変える場合は、Python 試作（`docs/prototype/sim_prototype.py`）を先に直し、`npm run golden` で正解データを作り直してから TS を合わせる。
