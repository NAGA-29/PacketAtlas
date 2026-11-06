# Packet Atlas — Claude Code 用メモ

設計書の全文は `docs/design.md`。移植元のプロトタイプは `prototype/realtime-protocols.html`。

## 何を作っているか
インターネットのプロトコルを「シーケンス図」と「バイト単位の分解」で学ぶ静的サイト。6部21レッスン。日本語先行、英語は後から。

## コマンド
- `pnpm dev` 開発サーバー
- `pnpm test` Vitest(構造チェック+バイト列の再計算)
- `pnpm build` 静的書き出し(`out/`)
- `pnpm e2e` Playwright + axe(先に `pnpm build`)
- `pnpm typecheck`

## 構成
- `src/lessons/types.ts` データモデル。`src/lessons/ja/*.ts` が1レッスン1ファイル。`src/lessons/index.ts` に登録(未執筆は `PLANNED`)
- `src/components/` SequenceDiagram / StepPanel / PacketInspector / LessonNav / LessonPlayer / SiteHeader
- `src/lib/codecs/` 検証用エンコーダー(テストからのみ使う。node:crypto 可)
- `src/lib/diagram.ts` 図の座標計算(純粋関数)
- `tests/lessons.schema.test.ts` 全レッスンの構造チェック、`tests/bytes/*` バイト列の再計算

## 守るルール
- 参考にした既存サイトのコード・CSS・画像・文章・バイト列・構成を持ち込まない。そのHTMLを取得・解析もしない
- 本文は RFC など一次資料から自分の言葉で。手順ごとに2〜4文(最初に「何が」、次に「なぜ」)
- 16進は「テストで再計算できる」か「desc に(例)/ `…` で省略」のどちらか
- hex は大文字2桁の空白区切り。Field は hex と text のどちらか一方。bits の合計 = バイト数×8
- 例のアドレスは 192.0.2.0/24・198.51.100.0/24・203.0.113.0/24・2001:db8::/32、ドメインは example.com / example.net(NATの内側だけプライベート可)
- 架空フォーマットは `fictional: true`、暗号化部分を復号後で見せるときは `view: 'decrypted'`
- 動きはパケットの移動だけ。reduced-motion で止める。色だけで意味を伝えない。WCAG AA
- 各フェーズの区切りは `pnpm test` と `pnpm build` が通ること

## バイト列の確かめ方(メモ)
- IPv4 / UDP / TCP / ICMP のチェックサムは `codecs/inet.ts` で再計算(RFC 1071 の数値例でエンコーダー自体も検証)
- DNS は `codecs/dns.ts` で組み立て、圧縮ポインターは `readName` でたどって確認
- TLS 1.3 の ClientHello は、`tests/fixtures/test-only-*.pem` で立てたローカルの Node TLS サーバーに実際に送り、TLS 1.3 の ServerHello が返ることを確かめる。乱数と公開鍵は(例)。RFC 8448 のトレースは環境から取得できなかったため使っていない

## 進捗
- [x] フェーズ1 土台(Next.js 静的書き出し、型、トークン、主要コンポーネント、レッスン画面)
- [x] フェーズ2 リアルタイム4章(WebSocket / WebRTC / ゲーム / WebTransport)、codecs とバイト列テスト、第6部の比較ページ
- [x] フェーズ3 UDP, TCP, DNS, TLS 1.3、第2部・第3部の比較ページ
- [ ] フェーズ4 Ethernet/ARP, IP, ICMP, DHCP, HTTP系4本(トップの見本図を HTTPS 通しに差し替え)
- [ ] フェーズ5 メールとリモート5本、OGP画像
- [ ] フェーズ6 英語版
