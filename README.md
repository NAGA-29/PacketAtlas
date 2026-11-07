# Packet Atlas

インターネットのプロトコルを、パケットが飛ぶシーケンス図とバイト単位の分解で学ぶ静的サイト(Next.js の静的書き出し)。

```bash
pnpm install
pnpm dev        # http://localhost:3000/ja/
pnpm lint       # ESLint
pnpm test       # 構造チェックとバイト列の再計算
pnpm build      # out/ に静的ファイルを書き出す
pnpm e2e        # Playwright + axe(build のあと)
pnpm og         # OGP 画像 public/og.png を作り直す
```

依存関係の安全設定は `pnpm-workspace.yaml` で管理します。`package.json` の `packageManager` に指定した pnpm を使用してください。

- 新しく依存関係を解決するときは、直接・間接依存とも公開から7日（10080分）以上経過したバージョンだけを選びます。除外パッケージは設けていません。
- 間接依存による Git・任意の tarball URL の利用を制限します。
- 依存パッケージのインストールスクリプトは明示的な許可制です。`sharp` と `unrs-resolver` は配布済みバイナリを使うためスクリプトを禁止し、新たな未確認スクリプトがあればインストールを失敗させます。必要になった場合は内容を確認して `allowBuilds` を更新してください。

pnpm 10.28.0 の公開後待機設定は依存解決時に適用され、既存のロックファイルを使うインストール（CI の `--frozen-lockfile` を含む）では公開日時を再検証しません。ロックファイルの更新にも、この設定を読み込む pnpm を使ってください。

デプロイ時は `SITE_URL`(例:`https://packet-atlas.example.com`)を設定してからビルドすると、OGP 画像のURLが絶対URLになります。

push とプルリクエストのたびに、GitHub Actions(`.github/workflows/ci.yml`)が lint・型チェック・テスト・ビルド・E2E を実行します。

設計は [docs/design.md](docs/design.md)、作業ルールは [CLAUDE.md](CLAUDE.md)。

## 参考

- [PROTOCOL EXPLORER](https://protocol-explorer-alpha.vercel.app/)
