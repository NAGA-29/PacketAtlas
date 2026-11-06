import type { Lesson } from '../types';

export const HTML_BODY = '<!doctype html><title>Example</title><p>Hello</p>';

const http11: Lesson = {
  id: 'http11',
  part: 4,
  order: 1,
  title: 'HTTP/1.1',
  tagline: 'テキストで頼み、テキストで返す',
  lead:
    '**人が読めるテキストで「これをください」と頼み、テキストのヘッダーを付けて返すプロトコル。**1本のTCP接続の上で、リクエストとレスポンスを1組ずつ順番にやり取りします。今もWebの基本で、HTTP/2 と HTTP/3 も意味は同じまま形だけを変えています。',
  overview: {
    layer: 'アプリケーション層',
    transport: 'TCP(+ TLS)',
    ports: '80(HTTPS は 443)',
    format: 'テキスト(ヘッダー + 任意の本文)',
    key: { label: '主なメソッド', value: 'GET、POST、PUT、DELETE、HEAD' },
    specs: ['RFC 9110', 'RFC 9112'],
  },
  lanes: [
    { id: 'browser', name: 'ブラウザ', sub: 'TCP接続済み' },
    { id: 'server', name: 'サーバー', sub: 'example.com:80' },
  ],
  steps: [
    {
      id: 'request',
      title: 'リクエスト:メソッド、パス、ヘッダー',
      hops: [{ from: 'browser', to: 'server', label: 'GET /', kind: 'data' }],
      body:
        '1行目は「メソッド・パス・バージョン」。続く行は `名前: 値` のヘッダーで、空行で終わります。行の区切りは必ず CR LF(`␍␊`)です。\n\n`Host` は必須です。1つのIPアドレスで複数のサイトを動かすとき、サーバーはこれを見てどのサイトか決めます。',
      packet: {
        name: 'HTTPリクエスト',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'リクエスト行', text: 'GET / HTTP/1.1␍␊', lineBreak: true, desc: 'メソッド GET、パス /' },
          { name: 'Host', text: 'Host: example.com␍␊', lineBreak: true, desc: 'HTTP/1.1 で必須' },
          { name: 'User-Agent', text: 'User-Agent: ExampleBrowser/1.0␍␊', lineBreak: true },
          { name: 'Accept', text: 'Accept: text/html␍␊', lineBreak: true, desc: '欲しい形式' },
          { name: 'Accept-Encoding', text: 'Accept-Encoding: gzip, br␍␊', lineBreak: true, desc: '圧縮して返してよい' },
          { name: '空行', text: '␍␊', lineBreak: true, desc: 'ヘッダーの終わり。GET に本文はない' },
        ],
      },
    },
    {
      id: 'response',
      title: 'レスポンス:ステータスと本文',
      hops: [{ from: 'server', to: 'browser', label: '200 OK', kind: 'data' }],
      body:
        '1行目は「バージョン・ステータスコード・説明」。200 は成功、3xx は別の場所へ、4xx はクライアント側の誤り、5xx はサーバー側の誤りです。\n\n`Content-Length` で本文のバイト数を伝えるので、受け取る側はどこまでが本文か分かり、同じ接続で次のやり取りに進めます。',
      packet: {
        name: 'HTTPレスポンス',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'ステータス行', text: 'HTTP/1.1 200 OK␍␊', lineBreak: true },
          { name: 'Content-Type', text: 'Content-Type: text/html; charset=utf-8␍␊', lineBreak: true },
          { name: 'Content-Length', text: 'Content-Length: 49␍␊', lineBreak: true, desc: '本文は49バイト' },
          { name: 'ETag', text: 'ETag: "v1-3f9a"␍␊', lineBreak: true, desc: 'この版の識別子(手順5で使う)' },
          { name: 'Cache-Control', text: 'Cache-Control: max-age=60␍␊', lineBreak: true, desc: '60秒は聞き直さずに使ってよい' },
          { name: '空行', text: '␍␊', lineBreak: true },
          { name: '本文', text: HTML_BODY, lineBreak: true, desc: 'ちょうど49バイト' },
        ],
      },
    },
    {
      id: 'keep-alive',
      title: '同じ接続で次を頼む(keep-alive)',
      hops: [
        { from: 'browser', to: 'server', label: 'GET /style.css', kind: 'data' },
        { from: 'server', to: 'browser', label: '200 OK', kind: 'data' },
      ],
      body:
        'HTTP/1.1 では、接続は基本的に開いたままです(**持続的接続**)。HTMLを読んだブラウザは、同じTCP接続でCSSを頼みます。TCPとTLSのハンドシェイクを毎回やり直さずに済みます。\n\nやめたいときは `Connection: close` を付けます。',
      packet: {
        name: 'HTTPリクエスト(2つ目)',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'リクエスト行', text: 'GET /style.css HTTP/1.1␍␊', lineBreak: true },
          { name: 'Host', text: 'Host: example.com␍␊', lineBreak: true },
          { name: 'Accept', text: 'Accept: text/css␍␊', lineBreak: true },
          { name: 'Referer', text: 'Referer: http://example.com/␍␊', lineBreak: true, desc: 'どのページから頼んだか' },
          { name: '空行', text: '␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'chunked',
      title: '長さが分からないときは chunked',
      hops: [{ from: 'server', to: 'browser', label: '200 OK (chunked)', kind: 'data' }],
      body:
        '本文を作りながら送るときは、最初に全体の長さが分かりません。そこで `Transfer-Encoding: chunked` にして、「16進の長さ + 中身」の塊を順に送り、長さ0の塊で終わりを示します。\n\n`1A` は16進で26、`0F` は15。受け取る側は塊をつなげて元の本文に戻します。',
      packet: {
        name: 'chunked のレスポンス',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'ステータス行', text: 'HTTP/1.1 200 OK␍␊', lineBreak: true },
          { name: 'Content-Type', text: 'Content-Type: text/plain␍␊', lineBreak: true },
          { name: 'Transfer-Encoding', text: 'Transfer-Encoding: chunked␍␊', lineBreak: true, desc: 'Content-Length の代わり' },
          { name: '空行', text: '␍␊', lineBreak: true },
          { name: '塊1の長さ', text: '1A␍␊', lineBreak: true, desc: '26バイト' },
          { name: '塊1', text: 'The first chunk of text.␍␊␍␊', lineBreak: true, desc: '中身26バイト(改行込み)+ 区切り' },
          { name: '塊2の長さ', text: '0F␍␊', lineBreak: true, desc: '15バイト' },
          { name: '塊2', text: 'And the rest.␍␊␍␊', lineBreak: true },
          { name: '終わり', text: '0␍␊␍␊', lineBreak: true, desc: '長さ0の塊で終わり' },
        ],
      },
    },
    {
      id: 'conditional',
      title: '変わっていなければ 304',
      hops: [
        { from: 'browser', to: 'server', label: 'GET / If-None-Match', kind: 'data' },
        { from: 'server', to: 'browser', label: '304 Not Modified', kind: 'data' },
      ],
      body:
        '60秒が過ぎたので、ブラウザは手元のコピーがまだ使えるかを確かめます。前回の `ETag` を `If-None-Match` に入れて頼むと、変わっていなければサーバーは本文なしの **304** を返します。\n\n本文を送り直さずに済むので、転送量が大きく減ります。',
      packet: {
        name: '条件付きリクエスト',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'リクエスト行', text: 'GET / HTTP/1.1␍␊', lineBreak: true },
          { name: 'Host', text: 'Host: example.com␍␊', lineBreak: true },
          { name: 'If-None-Match', text: 'If-None-Match: "v1-3f9a"␍␊', lineBreak: true, desc: '手元にある版' },
          { name: '空行', text: '␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'hol',
      title: '1本の接続では1つずつしか進まない',
      hops: [
        { from: 'browser', to: 'server', label: 'GET /big.jpg', kind: 'data' },
        { from: 'server', to: 'browser', label: '200 (大きい)', kind: 'data' },
        { from: 'browser', to: 'server', label: 'GET /app.js', kind: 'data' },
        { from: 'server', to: 'browser', label: '200', kind: 'data' },
      ],
      body:
        'HTTP/1.1 では、1本の接続で次のレスポンスは前のが終わるまで返せません。大きな画像の後ろで、小さなJSが待たされます(HTTPの**ヘッドオブラインブロッキング**)。\n\nそこでブラウザは同じサーバーに最大6本ほどの接続を並べて開きます。接続ごとにTCPとTLSの手間がかかるのが難点で、HTTP/2 はこれを1本の接続の中で解決します。',
      packet: {
        name: 'ブラウザの接続の使い方',
        note: 'ネットワークには流れない、ブラウザの中の状態です。',
        fields: [
          { name: '接続1', text: '/big.jpg を受信中 → 次に /app.js', lineBreak: true, desc: '画像が終わるまで JS は来ない' },
          { name: '接続2〜6', text: '並行して別のファイルを取る', lineBreak: true, desc: '1つのサーバーにつき6本程度まで' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9110 HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { label: 'RFC 9112 HTTP/1.1', url: 'https://www.rfc-editor.org/rfc/rfc9112' },
    { label: 'RFC 9111 HTTP Caching', url: 'https://www.rfc-editor.org/rfc/rfc9111' },
  ],
  lastVerified: '2026-11-06',
};

export default http11;
