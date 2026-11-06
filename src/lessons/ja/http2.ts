import type { BitField, Field, Lesson } from '../types';

const frameHeader = (len: string, lenDesc: string, type: string, typeDesc: string, flags: string, flagsDesc: string, stream: string, streamDesc: string, flagBits?: BitField[]): Field[] => [
  { name: '長さ', hex: len, desc: lenDesc },
  { name: '種別', hex: type, desc: typeDesc },
  { name: 'フラグ', hex: flags, desc: flagsDesc, bits: flagBits },
  { name: 'ストリームID', hex: stream, desc: streamDesc },
];

const HEADERS_FLAGS: BitField[] = [
  { name: '未使用', bits: 2 },
  { name: 'PRIORITY', bits: 1 },
  { name: '未使用', bits: 1 },
  { name: 'PADDED', bits: 1 },
  { name: 'END_HEADERS', bits: 1, desc: 'ヘッダーはこのフレームで終わり' },
  { name: '未使用', bits: 1 },
  { name: 'END_STREAM', bits: 1, desc: 'このストリームで送るものは終わり' },
];

const http2: Lesson = {
  id: 'http2',
  part: 4,
  order: 3,
  title: 'HTTP/2',
  tagline: '1本の接続にストリームを多重化する',
  lead:
    '**HTTP の意味はそのままに、やり取りをバイナリの「フレーム」に刻んで、1本の接続に何本も並べて流すプロトコル。**リクエストごとに番号(ストリームID)が付くので、レスポンスを順番どおりに待つ必要がなくなりました。ヘッダーは HPACK で圧縮します。',
  lanes: [
    { id: 'browser', name: 'ブラウザ', sub: 'TLS接続中' },
    { id: 'server', name: 'サーバー', sub: 'example.com:443' },
  ],
  steps: [
    {
      id: 'alpn',
      title: 'TLSの中で HTTP/2 を選ぶ(ALPN)',
      hops: [
        { from: 'browser', to: 'server', label: 'ClientHello ALPN', kind: 'control' },
        { from: 'server', to: 'browser', label: 'ALPN = h2', kind: 'control' },
      ],
      body:
        'ブラウザは ClientHello の **ALPN** 拡張で「h2 と http/1.1 が話せます」と伝えます。サーバーが h2 を選ぶと、TLSが終わった時点で HTTP/2 が始まります。\n\n追加の往復はかかりません。ブラウザの HTTP/2 は事実上 TLS の上だけで使われます。',
      packet: {
        name: 'ALPN 拡張(ClientHello の中)',
        layers: ['IPv4', 'TCP', 'TLS'],
        fields: [
          { name: '拡張の種別', hex: '00 10', desc: '16 = application_layer_protocol_negotiation' },
          { name: '拡張の長さ', hex: '00 0E', desc: '14バイト' },
          { name: '一覧の長さ', hex: '00 0C', desc: '12バイト' },
          { name: '「h2」', hex: '02 68 32', desc: '長さ2 + 「h2」' },
          { name: '「http/1.1」', hex: '08 68 74 74 70 2F 31 2E 31', desc: '長さ8 + 「http/1.1」' },
        ],
      },
    },
    {
      id: 'preface',
      title: '合言葉と SETTINGS で始める',
      hops: [
        { from: 'browser', to: 'server', label: 'プリフェイス + SETTINGS', kind: 'control' },
        { from: 'server', to: 'browser', label: 'SETTINGS', kind: 'control' },
        { from: 'browser', to: 'server', label: 'SETTINGS ACK', kind: 'control' },
        { from: 'server', to: 'browser', label: 'SETTINGS ACK', kind: 'control' },
      ],
      body:
        'ブラウザは最初に24バイトの決まった文字列(**コネクションプリフェイス**)を送ります。HTTP/1.1 しか知らないサーバーなら、おかしなリクエストとして弾いてくれる形になっています。\n\n続いて両側が SETTINGS フレームで「同時に開けるストリームは100まで」などの条件を伝え、互いに ACK を返します。',
      packet: {
        name: 'プリフェイスと SETTINGS フレーム',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/2'],
        view: 'decrypted',
        fields: [
          { name: 'プリフェイス', hex: '50 52 49 20 2A 20 48 54 54 50 2F 32 2E 30 0D 0A 0D 0A 53 4D 0D 0A 0D 0A', desc: '「PRI * HTTP/2.0␍␊␍␊SM␍␊␍␊」' },
          ...frameHeader('00 00 0C', '12バイト', '04', 'SETTINGS', '00', 'ACK ではない', '00 00 00 00', '0 = 接続全体の話'),
          { name: 'MAX_CONCURRENT_STREAMS', hex: '00 03 00 00 00 64', desc: '同時に100ストリームまで' },
          { name: 'INITIAL_WINDOW_SIZE', hex: '00 04 00 00 FF FF', desc: 'ストリームごとの受信枠 65535バイト' },
        ],
      },
    },
    {
      id: 'headers',
      title: 'HEADERS フレームでリクエスト',
      hops: [{ from: 'browser', to: 'server', label: 'HEADERS stream 1', kind: 'data' }],
      body:
        'リクエストは HEADERS フレームになります。`GET` や `/` は `:method`・`:path` という特別なヘッダー(疑似ヘッダー)で表し、**HPACK** で圧縮します。よく使う組は静的テーブルの番号1バイトで済みます。\n\nクライアントが開くストリームは奇数番号です。最初のリクエストはストリーム1。',
      packet: {
        name: 'HEADERS フレーム(ストリーム1)',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/2'],
        view: 'decrypted',
        note: 'ここでは読みやすさのため、文字列にハフマン符号を使わない形で示しています。実際のブラウザはたいていハフマン符号で縮めます。',
        fields: [
          ...frameHeader('00 00 10', '16バイト', '01', 'HEADERS', '05', 'END_STREAM + END_HEADERS', '00 00 00 01', 'ストリーム1', HEADERS_FLAGS),
          { name: ':method GET', hex: '82', desc: '静的テーブル2番をそのまま使う(先頭bit=1)' },
          { name: ':scheme https', hex: '87', desc: '静的テーブル7番' },
          { name: ':path /', hex: '84', desc: '静的テーブル4番' },
          { name: ':authority', hex: '41 0B 65 78 61 6D 70 6C 65 2E 63 6F 6D', desc: '名前は1番、値「example.com」は文字で。動的テーブルに追加する(01xxxxxx)' },
        ],
      },
    },
    {
      id: 'hpack',
      title: '2つ目のリクエストはもっと小さい',
      hops: [
        { from: 'browser', to: 'server', label: 'HEADERS stream 3', kind: 'data' },
        { from: 'browser', to: 'server', label: 'HEADERS stream 5', kind: 'data' },
      ],
      body:
        '前のリクエストで `:authority: example.com` を**動的テーブル**に入れたので、今回は62番の1バイト `BE` で済みます。HTTP/1.1 では毎回同じヘッダーを文字で送っていました。\n\nレスポンスを待たずに、ストリーム3、5と続けて頼めます。',
      packet: {
        name: 'HEADERS フレーム(ストリーム3)',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/2'],
        view: 'decrypted',
        fields: [
          ...frameHeader('00 00 0F', '15バイト', '01', 'HEADERS', '05', 'END_STREAM + END_HEADERS', '00 00 00 03', 'ストリーム3', HEADERS_FLAGS),
          { name: ':method GET', hex: '82' },
          { name: ':scheme https', hex: '87' },
          { name: ':path /style.css', hex: '04 0A 2F 73 74 79 6C 65 2E 63 73 73', desc: '名前は4番、値は文字。テーブルには追加しない(0000xxxx)' },
          { name: ':authority', hex: 'BE', desc: '動的テーブルの62番 = example.com' },
        ],
      },
    },
    {
      id: 'multiplex',
      title: 'レスポンスは混ざって返ってくる',
      hops: [
        { from: 'server', to: 'browser', label: 'DATA stream 3', kind: 'data' },
        { from: 'server', to: 'browser', label: 'DATA stream 1', kind: 'data' },
        { from: 'server', to: 'browser', label: 'DATA stream 5', kind: 'data' },
        { from: 'server', to: 'browser', label: 'DATA stream 1', kind: 'data' },
      ],
      body:
        'サーバーはできたものから、DATA フレームに刻んで返します。小さいCSS(ストリーム3)が、大きいHTML(ストリーム1)の途中に割り込めます。受け取る側はストリームIDで仕分けます。\n\nこれが**多重化**です。1本の接続で済むので、HTTP/1.1 のように接続を6本も開く必要がなくなりました。',
      packet: {
        name: 'DATA フレーム(ストリーム3)',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/2'],
        view: 'decrypted',
        fields: [
          ...frameHeader('00 00 0E', '14バイト', '00', 'DATA', '00', 'END_STREAM なし(まだ続く)', '00 00 00 03', 'ストリーム3 の本文'),
          { name: 'データ', hex: '62 6F 64 79 7B 6D 61 72 67 69 6E 3A 30 7D', desc: '「body{margin:0}」' },
        ],
      },
    },
    {
      id: 'tcp-hol',
      title: 'TCPの1つの落としものが全部を止める',
      hops: [
        { from: 'server', to: 'browser', label: 'TCP: DATA 3', kind: 'data', lost: true },
        { from: 'server', to: 'browser', label: 'TCP: DATA 1, 5', kind: 'data' },
        { from: 'browser', to: 'browser', label: '全ストリーム待ち', kind: 'control' },
        { from: 'server', to: 'browser', label: 'TCP 再送', kind: 'data' },
      ],
      body:
        'ストリーム3のデータを運んでいたTCPセグメントが落ちました。後ろのセグメントにはストリーム1と5のデータが届いていますが、TCPは順番どおりにしか渡せないので、再送が届くまで**全ストリームが止まります**。\n\nHTTPの層で解いたヘッドオブラインブロッキングが、TCPの層に残っていたのです。これを解くために HTTP/3 は TCP をやめました。',
      packet: {
        name: 'ブラウザの受信バッファ',
        note: 'ネットワークには流れない、受信側の状態です。',
        fields: [
          { name: 'TCP', text: '[欠け] [DATA 1] [DATA 5]', lineBreak: true, desc: '欠けの後ろはアプリに渡せない' },
          { name: 'HTTP/2', text: 'ストリーム 1, 3, 5 すべて待ち', lineBreak: true, desc: '3 と関係ない 1 と 5 も止まる' },
        ],
      },
    },
    {
      id: 'flow-control',
      title: 'ストリームごとに流量を調整する',
      hops: [{ from: 'browser', to: 'server', label: 'WINDOW_UPDATE', kind: 'control' }],
      body:
        'HTTP/2 は TCP とは別に、自分でも受信枠を管理します。ブラウザは読んだ分だけ WINDOW_UPDATE で枠を広げ、サーバーは枠の範囲でしか DATA を送れません。\n\nストリームIDが0なら接続全体、それ以外ならそのストリームだけの枠です。1本の大きなダウンロードが、他のストリームの枠まで使い切らないようにできます。',
      packet: {
        name: 'WINDOW_UPDATE フレーム',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/2'],
        view: 'decrypted',
        fields: [
          ...frameHeader('00 00 04', '4バイト', '08', 'WINDOW_UPDATE', '00', '', '00 00 00 00', '0 = 接続全体の枠'),
          { name: '増分', hex: '00 01 00 00', desc: '65536バイト広げる(先頭bitは予約)' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9113 HTTP/2', url: 'https://www.rfc-editor.org/rfc/rfc9113' },
    { label: 'RFC 7541 HPACK', url: 'https://www.rfc-editor.org/rfc/rfc7541' },
    { label: 'RFC 7301 TLS ALPN', url: 'https://www.rfc-editor.org/rfc/rfc7301' },
    { label: 'RFC 9110 HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
  ],
  lastVerified: '2026-11-06',
};

export default http2;
