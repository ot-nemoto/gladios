# CLAUDE.md

作業前に `README.md` を読むこと（設計書の場所、進め方の約束、ディレクトリ構成、実装の約束がある）。

## 作業の流れ（必ず守る）

README の「作業の流れ（Issue・ブランチ・PR）」の全項目を守る。規則の正は README で、内容はここに写さない。
項目は次の 7 つ（各項目の中身は README を読むこと）：Issue を先に作る／ブランチ／コミットメッセージ／PR／
PR のマージはマージコミット／PR 作成後のエージェントレビュー（対応の記録・再レビュー・マージ条件を含む）／別件は新しい Issue。

## 確認

- 変更後は `npm run typecheck` と `npm test` を通す。
- `src/sim/` の判定を変える場合は、Python 試作（`docs/prototype/sim_prototype.py`）を先に直し、`npm run golden` で正解データを作り直してから TS を合わせる。
