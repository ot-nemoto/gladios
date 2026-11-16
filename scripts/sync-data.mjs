// docs/prototype/ にある正のデータを src/data/ へ写す。
// キーフレームは Python の build_keyframes_full.py が正。src/data/ 側は手で直さない。
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FILES = ['keyframes-full.json', 'check-conditions-v1.json'];
const root = fileURLToPath(new URL('..', import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of FILES) {
    copyFileSync(`${root}docs/prototype/${f}`, `${root}src/data/${f}`);
    console.log(`synced ${f}`);
  }
}
