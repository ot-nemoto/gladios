# gladios — 剣闘士オートバトルゲーム

古代ローマ（紀元80年頃）を舞台にした、剣闘士本人として戦う1対1の完全自動戦闘ゲームの設計と試作。
プレイヤーは事前の装備・作戦の組み立てだけを行い、戦闘は自動で進行する。

## 最初に読むもの

1. **設計書（正）**: `docs/01_ゲーム企画・基本設計書.md`
   - 設計の決定はすべてこの単一ファイルに集約する。分割しない。
   - バージョンはファイル冒頭と §12 の変更履歴で管理する（ファイル名には付けない）。現在の本文バージョンは v3.43。
   - §14 に進捗記録と残作業がある。作業前に必ず本文と §14 を読むこと。
2. **試作シミュレータ**: `docs/prototype/sim_prototype.py`（設計書の戦闘規則の検証用）
   - 実行: `python3 docs/prototype/sim_prototype.py` → 結果は `docs/prototype/sim-run-2026-11-15.txt` に出る（ファイル名は固定のまま中身が更新される）。
   - 確認条件は `check-conditions-v1.md` / `.json`（全能力50の同条件対戦が基準）。
   - キーフレームは `keyframes-full.json`（88セット）が正。生成は `build_keyframes_full.py` 経由（手で直さない。再生成で `refDistance` が保持される）。
   - 個別の確認記録は `check-*.txt`。設計判断の根拠はここにある。
3. **グラフィックス方針メモ**: `docs/グラフィックス方針メモ.md`（ドット絵制作の方針・手順。設計書とは別文書）
   - PixelLab の API キーは保存されていない。制作を始める前にユーザーに確認すること。

## ディレクトリ構成

```
/                     Vite + TypeScript のブラウザゲーム本体（package.json はルート）
├─ src/
│  ├─ sim/            戦闘判定の中核。DOM・乱数・時計を使わない純粋な TS（決定性を守る層）
│  │  └─ trig.ts      三角関数の唯一の入口。sim/ では Math.sin 等を直接呼ばない
│  ├─ data/           docs/prototype から写したデータ（手で直さない）
│  ├─ scenarios/      確認用シナリオ（ビューアと Python 一致テストで共用）
│  ├─ render/         描画（Canvas 2D。今は判定領域をそのまま描く骨格表示、後でドット絵に差し替え）
│  └─ ui/             画面（戦闘ビューア、モーション図鑑。作戦編集は今後）
├─ tests/             Vitest
├─ scripts/           補助スクリプト（sync-data.mjs など）
└─ docs/
   ├─ 01_ゲーム企画・基本設計書.md
   ├─ グラフィックス方針メモ.md
   └─ prototype/      Python 試作・キーフレーム・確認条件・check-*.txt
```

- 設計書 §14 などに出てくるファイル名（`sim_prototype.py`、`check-*.txt`、`keyframes-full.json` など）は、すべて `docs/prototype/` にある。設計書本文はライブラリの原本と揃えるため、パスの書き換えはしていない。
- キーフレームと確認条件の正は `docs/prototype/` 側。更新したら `npm run sync:data` で `src/data/` へ写す（ずれはテストで検知される）。

### コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー。`/` が戦闘ビューア（Space 再生/停止、←→ 0.1秒送り〔Shift で1秒〕、[ ] 前後のイベント）、`/motions.html` がモーション図鑑（88 のキーフレーム一式の姿勢・軌道・段階・最初の接触。←→ キーフレーム間、, . 1ステップ送り、↑↓ 一式の切り替え） |
| `npm run build` | 型検査＋本番ビルド |
| `npm test` | テスト |
| `npm run sync:data` | `docs/prototype/` のデータを `src/data/` へ写す |
| `npm run golden` | Python 試作の出力を `tests/golden/sim-prototype.json` に書き出す（TS 移植の正解データ） |

### 実装の約束

- `src/sim/` は決定性を守る。`Math.random`・`Date`・DOM を使わない。三角関数は `trig.ts` 経由（現在は Python 試作と一致させるため標準の Math。環境間の完全一致が要る段階で自前実装に差し替える）。
- 戦闘の正式な記録はイベントログ（設計書 §5.9）。
- `src/sim/` の判定本体（`sim.ts` と、それが使う `body` / `contact` / `rules` / `select` など）は Python 試作 `sim_prototype.py` の忠実な移植で、`src/scenarios/check-scenarios.json` の全シナリオでログ・結果・最終状態が Python と完全一致することをテストで確認している。試作側の規則を変えたら `npm run sync:data` → `npm run golden` で正解データを更新し、TS 側を合わせる。
- `src/sim/record.ts`（リプレイの記録）と `src/sim/motion.ts`（モーション図鑑の計算）は移植ではなく、判定と同じ関数・定数を使う補助。判定と食い違わないよう、接触の分類（`contact.ts`）や行動時間の定数（`data.ts`）は判定と共有し、独自に書き写さない。表示用の名前は `src/ui/` に置く。

## 進め方の約束（重要）

- **1回に1つの論点**だけを扱う。まず推奨案を理由と懸念つきで提示し、ユーザーの承認を得てから決定として仕様書に反映する。承認されていない提案を決定にしない。
- ユーザーの「OK」は、直前の提案への承認を意味する。ユーザーが考えながら覆すこともあるので、その場合は議論を続ける。
- 戦闘は**完全決定性**（乱数による命中・成功率を持たない。同じ入力は同じ結果）。差は速度・タイミング・位置・軌道・行動の質でつける。
- ファンタジー要素は入れない。舞台は紀元80年頃のローマ。
- 数値は原則「仮置き」。決定と仮置きと未決定を区別して書く。
- 仕様が変わったら、本文の該当節と §12 の変更履歴の両方を更新する。試作で規則を検証したら `check-*.txt` に記録を残し、§14 にも1行残す。
- このリポジトリの設計書は作業用ドラフト。ユーザーの手元（ライブラリ）にある原本とは版管理が別で、そちらへの反映はユーザーが行う。

## 作業の流れ（Issue・ブランチ・PR）

- **作業単位ごとに GitHub Issue を作る。** 着手前に、目的・作業内容・完了条件を書いた Issue を立てる（設計の論点も1論点＝1 Issue）。
- **ブランチ**は `develop` から切る。名前は `<種類>/<Issue番号>-<短い説明>`（例: `feature/12-strategy-rules`、`fix/15-approach-overshoot`）。複数 Issue をまとめて扱う場合は代表の内容で名付ける。種類は `feature` / `fix` / `docs` / `chore` / `refactor`。
- **コミットメッセージ**には対応する Issue 番号を `(#12)` の形で入れる。
- **PR** は `develop` 向けに出し、本文に `Closes #12` の形で対応する Issue をすべて書いて紐づける（マージで自動クローズされる）。
- **PR のマージはマージコミット**で行う（squash しない）。master への自動 PR が「Merge pull request #N」から PR と Issue を拾うため。
- **PR を作成したら、その PR に対してエージェントによるコードレビューを行う**（Claude Code の `/code-review high <PR番号>`）。
  - 指摘のうち、その PR で入れた変更の問題は同じ PR で直して push する。PR の範囲外のもの、仕様の判断を伴うもの、Python 試作の修正が要るものは新しい Issue にする。
  - レビューの結果（指摘と、それぞれ直したか・Issue にしたか）を PR にコメントで残す。
  - 指摘を直すためにコードを変えた場合は、修正後の状態にもう一度レビューを行う。新しい指摘がなくなるまで繰り返す（修正が文言だけなら再レビューは不要）。
  - マージはレビューと CI が済んでから行う。
- 作業中に見つかった別件は、その場で直さず新しい Issue にする。

## CI・公開・リリース（GitHub Actions）

| ワークフロー | いつ | 何をする |
|---|---|---|
| `ci.yml` | PR、develop への push | 型検査・テスト・ビルド |
| `secret-scan.yml` | PR、毎週月曜 | gitleaks で秘密情報の混入を検出（PR は差分、定期は全履歴） |
| `deploy-github-pages.yml` | develop への push | 戦闘ビューアとモーション図鑑を GitHub Pages に公開（https://ot-nemoto.github.io/gladios/ 、図鑑は `motions.html`） |
| `auto-pr-to-master.yml` | 毎朝 6:00（JST） | develop → master の PR を作成・更新。含まれる Issue に `enhancement` があれば `bump:minor`、なければ `bump:patch` を付ける |
| `bump-version.yml` | master 向け PR に bump ラベル | package.json の版を上げてコミット |
| `release.yml` | master への push | package.json の版でタグと GitHub Release を作る |
| `dependabot.yml` | 毎週 | npm・devcontainers・GitHub Actions の更新 PR を develop 向けに作る |

- 自動 PR にはリポジトリのシークレット `AUTO_PR_TOKEN`（PR とラベルを操作できるトークン）が必要。
- gitleaks の版は Dependabot の対象外なので、`secret-scan.yml` の版とチェックサムを手で更新する。

## 現在の状態（2026-11-16、v3.43）

- 戦闘システムの基礎（座標・キーフレーム・軌道と初回接触・盾と防具・ダメージ段階・スタミナ・体勢・負傷・作戦と防御方針・構えモデル・読み・受け流しの姿勢保持・盾の押し込み）は設計と試作確認が済んでいる。
- §14 の残作業は2件: (1) 共通キーフレームの未指定分（約2セット）、(2) 仮置き数値の調整。
- 成長システムなど戦闘以外は、方針のみで詳細は凍結中（戦闘を先に固める方針）。
- グラフィックスはドット絵方針が決まり、PixelLab の試作段階（有料化は未決定）。
