// docs/prototype/ にある正のデータを src/data/ へ写す。
// キーフレームは Python の build_keyframes_full.py が正。src/data/ 側は手で直さない。
// 対象ファイルの一覧は sync-files.json（tests/data-sync.test.ts と共用）。
import { copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = JSON.parse(readFileSync(`${root}scripts/sync-files.json`, 'utf-8'));

for (const f of files) {
  copyFileSync(`${root}docs/prototype/${f}`, `${root}src/data/${f}`);
  console.log(`synced ${f}`);
}
