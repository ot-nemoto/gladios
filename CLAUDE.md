# CLAUDE.md

作業前に `README.md` を読むこと（設計書の場所、進め方の約束、ディレクトリ構成、実装の約束がある）。

## 作業の流れ（必ず守る）

README の「作業の流れ（Issue・ブランチ・PR）」の項目をすべて守る。規則の正は README で、ここには写さない。
特に次の手順を飛ばさないこと：Issue を先に作る → `develop` からブランチ → コミットに Issue 番号 →
PR に `Closes #番号` → **PR 作成後にエージェントによるコードレビューと対応の記録** → **レビューと CI が済んでからマージ**。

## 確認

- 変更後は `npm run typecheck` と `npm test` を通す。
- `src/sim/` の判定を変える場合は、Python 試作（`docs/prototype/sim_prototype.py`）を先に直し、`npm run golden` で正解データを作り直してから TS を合わせる。
