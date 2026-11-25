# gladios — 小さな装備室

低頭身の女性剣闘士の兜を切り替えて見比べる着せ替え見本です。[公開ページ](https://ot-nemoto.github.io/gladios/)で試せます。

「兜なし」「銀・青緑の兜」「黒金・紫の兜」「金・赤の兜」「銀・角付きの兜」「金・一本角の兜」「黒・赤い鶏冠の兜」の7種類を選べます。「兜を外す」で基本の姿に戻り、選んだ立ち絵をPNGで保存できます。スマートフォンでも表示できます。

元の全身画像7枚を切り替えるページに加え、[装備を着脱するページ](https://ot-nemoto.github.io/gladios/equipment.html)を用意しています。同じレイアウトで両方式を行き来して比較できます。

着脱版は同じ人物に6種類の兜パーツを重ねます。兜を外すと元の髪型に戻り、着けた姿を合成PNGとして保存できます。[顔と兜のサイズ比較](https://ot-nemoto.github.io/gladios/helmet-fit.html)では、元の顔と各兜を同じ倍率で並べ、半透明表示と基準線で大きさや位置を確認できます。着脱版へ追加した兜は比較画面にも反映されます。

[キャラと背景を組み合わせるページ](https://ot-nemoto.github.io/gladios/scene.html)では、背景透過の剣闘士（TADALA、MARCUS MARIUS AVITUS、BERENICE、CASSIA、GOLD HILDR、VLATTIA、SPATALIA、KRIMHARTH、BRANTHOC、TUKHORIS、KASOS、THALES、KHNUBA、MEDOCUS、GAIUS PONTIDIUS STOLO、SALOMON、AMBILLUS、EATHYROSS、AKILIAS、IGRAINE）と背景（海、雪原、草原、森、湿地、山、街、洞窟、松と金雲、鶴と青海波、桜と金屏風、竹と金月、梅と金の雪、富士の裾と金雲、鯉と滝、紅葉と金流水、大聖堂のバラ窓、ゴシック尖頭アーチ、中世グリザイユ、夜の大聖堂、藤とトンボ、バラ園アーチ、海と帆船、ケルト結び目、孔雀の羽、葡萄と秋の葉、蓮と水、星座の円環）を選んで重ね、512×512のPNGとして保存できます。

武器・防具の着脱やモーション・戦闘判定はありません。

## 手元で開く

Node.js 24 が必要です。

```sh
npm ci
npm run dev
```

http://localhost:5173/ で画像切替版、http://localhost:5173/equipment.html で装備着脱版、http://localhost:5173/helmet-fit.html でサイズ比較、http://localhost:5173/scene.html で背景との組み合わせが開きます。

## 資料

- [装備室の基本設計書](docs/01_ゲーム企画・基本設計書.md)
- [開発ガイド](docs/development.md)
- [過去の戦闘構想・試作資料](docs/archive/README.md)
