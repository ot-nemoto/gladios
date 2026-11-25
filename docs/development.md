# 開発ガイド

gladios の開発者向けの情報。アプリでできることは [README](../README.md) を参照。

- 開発の規則はこの文書だけに書く。[AGENTS.md](../AGENTS.md) は共通の入口。[CLAUDE.md](../CLAUDE.md) はこの文書を `@docs/development.md` で取り込み、規則の置き場所を案内するだけなので、エージェント（Claude Code）にもこの文書がそのまま渡る。
- README はアプリの紹介（利用者向け）で、開発の規則や手順は書かない。

## 設計資料（最初に読むもの）

1. **現行の基本設計**: [Gladios 基本設計書](01_基本設計書.md)
   - 作業前に本文を読む。アプリの現在の仕様・未決事項（§3）・確認の範囲（§4）を確認する。
   - 承認された仕様変更は本文の該当節へ反映する。実装の詳細は引き継ぎ資料に置き、二重管理しない。
   - 設計書には変更履歴・経緯を書かない。変更の経緯・検証結果は Issue と PR に残す。
   - 仕様書にバージョン番号は記載しない。変更の経緯はGit・Issue・PRで追跡する。

実装構成・素材の追加手順・他のLLMへの渡し方は [引き継ぎ資料](引き継ぎ.md)、依頼内容の書き方は [依頼テンプレート](依頼テンプレート.md) を参照。

## ディレクトリ構成

```
/
├─ AGENTS.md           エージェント共通の入口
├─ CLAUDE.md           Claude Code向けの規則の参照
├─ index.html          合成アプリ（トップページ）
├─ src/scene.ts        選択欄・Canvas合成・PNG保存・サムネイルの段階的な読み込み
├─ src/scene.css       ページの表示
├─ src/scene-data.ts   キャラ・背景の候補と素材の定義
├─ src/common.ts       要素の取得と画像の読み込み（キャッシュ付き）
├─ src/assets/scene/   キャラ（背景透過の可逆webp）と背景（webp）、thumbs/ に選択欄用の縮小画像
├─ vite.config.ts      開発サーバーの設定
├─ tsconfig.json       TypeScriptの設定
└─ docs/
   ├─ development.md   開発ガイド（この文書）
   ├─ 01_基本設計書.md
   ├─ 引き継ぎ.md
   └─ 依頼テンプレート.md
```

## コマンド・実装の扱い

Node.js 24 が必要。開発サーバーは http://localhost:5173/ で開く。

| コマンド | 内容 |
|---|---|
| `npm ci` | ロックファイルに従って依存をインストール |
| `npm run dev` | 開発サーバー（http://localhost:5173/） |
| `npm run typecheck` | 型検査 |
| `npm run build` | 型検査＋本番ビルド |
| `npm run preview` | 本番ビルドを手元で確認 |

- 変更したら `npm run typecheck` と `npm run build` を通す。
- 自動テストはなく、テストコマンドやVitestの依存も置いていない。動作の確認は、ビルド後の `vite preview` をブラウザ（必要なら Playwright）で操作して行う。
- 基本設計書は、現在の仕様・未決事項・確認の範囲だけをまとめ、過去の記録は掲載しない。過去の実装や記録はGit履歴・Issue・PRから参照する。

## 設計の進め方の約束（重要・必ず守る）

- **1回に1つの論点**だけを扱う。まず推奨案を理由と懸念つきで提示し、ユーザーの承認を得てから決定として仕様書に反映する。承認されていない提案を決定にしない。
- ユーザーの「OK」は、直前の提案への承認を意味する。ユーザーが考えながら覆すこともあるので、その場合は議論を続ける。
- 数値は原則「仮置き」。決定と仮置きと未決定を区別して書く。
- 仕様が変わったら、本文の該当節を更新する。検証結果と未検証事項は対応 Issue に記録する。確認の範囲が変わったら §4 を更新する。
- このリポジトリの設計書は作業用ドラフト。ユーザーの手元（ライブラリ）にある原本への反映はユーザーが行う。

## 作業の流れ（Issue・ブランチ・PR）（必ず守る）

- **作業単位ごとに GitHub Issue を作る。** ブランチを切る前に、目的・作業内容・完了条件を書いた Issue を `gh issue create` で立てる（設計の論点も1論点＝1 Issue）。以下、Issue → ブランチ → コミット → PR → エージェントレビュー → 指摘対応 → マージ の順に進める。
- **Issue 作成時、または実装完了後に、動作確認一覧を Issue 本文へ追加する。** 確認する操作・条件と期待する結果をチェックリストで記載し、実施後は結果を Issue に残す。確認済みの項目には ✅ を付け、チェックリストもチェック済みにする。未確認・検証できない項目には ✅ を付けず、未チェックのまま理由を記載する。AI 側で動作確認できる項目は AI が実施し、ブラウザでの確認が必要なら Playwright を利用してよい。どうしても検証できない項目がある場合は、未検証であることと理由・確認手順・期待する結果を明記し、その項目の確認をユーザーへ依頼する。
- **ブランチ**は `develop` から切る。名前は `<種類>/<Issue番号>-<短い説明>`（例: `feature/12-strategy-rules`、`fix/15-approach-overshoot`）。複数 Issue をまとめて扱う場合は代表の内容で名付ける。種類は `feature` / `fix` / `docs` / `chore` / `refactor`。
- **コミットメッセージ**には対応する Issue 番号を `(#12)` の形で入れる。
- **PR** は `develop` 向けに出し、本文に `Closes #12` の形で対応する Issue をすべて書いて紐づける（マージで自動クローズされる）。
- **PR を作成したら、その PR に対してエージェントによるコードレビューを行う**（Claude Code の `/code-review high <PR番号>`）。
  - 対象外：develop → master の自動 PR（`auto-pr-to-master.yml`。中身は各 PR でレビュー済み）と、Dependabot の npm の更新 PR（CI で確認する）。
  - Dependabot の devcontainers・GitHub Actions の更新 PR は、マージする前にレビューする（CI は開発コンテナの構築や、Pages 配信・リリースのワークフローを実行しないため）。直す必要がある指摘が出たら、Dependabot のブランチには push せず、Issue にして PR を保留するか閉じる。
  - 指摘ごとに次のどれかで対応する。
    - **直す**：その PR の変更で入った問題。直し方に仕様の判断が要る場合は、ユーザーに確認してから直す。
    - **Issue にする**：PR が変えていない既存の問題、PR の範囲外の改善。
    - **不採用**：指摘が誤っている、または対応しない方がよいもの。理由を書く。
  - **エージェントレビューは1回とし、指摘対応後の再レビューは不要。** 修正した内容は必要な動作確認・チェックで検証し、結果を Issue の動作確認一覧に残す。
  - 結果（指摘と、それぞれの対応と理由）を PR にまとめのコメントで残す。対応の記録になるため、`--comment` による行コメントの投稿では代えない。
  - レビュー対象の PR は、エージェントレビュー・指摘対応・結果のコメントが済み、指摘対応後の最新コミットで CI が通ってからマージする。
- **PR のマージはマージコミット**で行う（squash しない）。master への自動 PR が「Merge pull request #N」から PR と Issue を拾うため。
- 作業中に見つかった別件は、その場で直さず新しい Issue にする。

## CI・公開・リリース（GitHub Actions）

| ワークフロー | いつ | 何をする |
|---|---|---|
| `ci.yml` | PR、develop への push | 型検査・ビルド |
| `secret-scan.yml` | PR、毎週月曜 | gitleaks で秘密情報の混入を検出（PR は差分、定期は全履歴） |
| `deploy-github-pages.yml` | develop への push | 現在のページを GitHub Pages に公開（https://ot-nemoto.github.io/gladios/） |
| `auto-pr-to-master.yml` | 毎朝 6:00（JST） | develop → master の PR を作成・更新。含まれる Issue に `enhancement` があれば `bump:minor`、なければ `bump:patch` を付ける |
| `bump-version.yml` | master 向け PR に bump ラベル | package.json の版を上げてコミット |
| `release.yml` | master への push | package.json の版でタグと GitHub Release を作る |
| `dependabot.yml` | 毎週 | npm・devcontainers・GitHub Actions の更新 PR を develop 向けに作る |

- 自動 PR にはリポジトリのシークレット `AUTO_PR_TOKEN`（PR とラベルを操作できるトークン）が必要。
- gitleaks の版は Dependabot の対象外なので、`secret-scan.yml` の版とチェックサムを手で更新する。

## 設計の進捗の参照先

未決事項は基本設計書 §3、進捗・残作業・確認待ちは対応 Issue で確認する。開発ガイドには重複して記録しない。
