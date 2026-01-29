# 情報交換＝人間関係 シミュレーター v1.2

「受信・無視・処理」をAIに委譲できる社会で、情報交換＝人間関係がどう変質するかを可視化するシミュレーターです。

## 仕様

- **実装要件 v1.2**（run.json スキーマ 1.2.0）に準拠
- **技術スタック**: TypeScript + Vite + D3.js (force) + Canvas
- **レイアウト**: 単一画面・サイドバー禁止・ページ遷移なし

### 可視化

- **G1**: ネットワーク図（ノード＝人間、エッジ太さ＝重要度 I[a][b]、メッセージ＝粒子）
- **G2**: 委譲率ダッシュボード（Total Messages, Replies by Human/AI, Human Ignores, Direct Human↔Human, AI Processed %）
- **G3**: 折れ線グラフ（直接 Human↔Human 返信数 vs AI 返信数の時系列）

### 表示モード

- **表面**: 返信はすべて「人→人」として表示
- **裏側**（トグル）: AI 返信を赤、人間返信を緑で区別表示

### 出力

- **Export JSON**: 1実行分を run.json 形式でダウンロード（スキーマ 1.2.0）
- **Screenshot**: ネットワークの Canvas を PNG で保存

## セットアップ

```bash
cd Ethics
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開いてください。

## ビルド

```bash
npm run build
```

`dist/` に静的ファイルが出力されます。
"# ethics" 
