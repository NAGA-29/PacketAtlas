# Packet Atlas

インターネットのプロトコルを、パケットが飛ぶシーケンス図とバイト単位の分解で学ぶ静的サイト(Next.js の静的書き出し)。

```bash
pnpm install
pnpm dev        # http://localhost:3000/ja/
pnpm test       # 構造チェックとバイト列の再計算
pnpm build      # out/ に静的ファイルを書き出す
pnpm e2e        # Playwright + axe(build のあと)
pnpm og         # OGP 画像 public/og.png を作り直す
```

デプロイ時は `SITE_URL`(例:`https://packet-atlas.example.com`)を設定してからビルドすると、OGP 画像のURLが絶対URLになります。

設計は [docs/design.md](docs/design.md)、作業ルールは [CLAUDE.md](CLAUDE.md)。
