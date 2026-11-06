import type { Lesson } from '../types';

const webtransport: Lesson = {
  id: 'webtransport',
  part: 6,
  order: 4,
  title: 'WebTransport',
  tagline: 'HTTP/3の上で、データグラムと独立したストリームを使い分ける',
  lead:
    '**ブラウザからUDPに近い通信を使うための新しい選択肢。**HTTP/3(QUIC)の上で動き、信頼性のない「データグラム」と、互いに独立した「ストリーム」を1つの暗号化接続で使い分けられます。ゲーム章のUDPパケットをそのまま運べます。',
  overview: {
    layer: 'アプリケーション層',
    transport: 'HTTP/3(QUIC)',
    ports: '443(UDP)',
    format: 'バイナリ(データグラムとストリーム)',
    key: { label: '使う仕組み', value: '拡張 CONNECT、DATAGRAM、双方向・一方向のストリーム' },
    specs: ['RFC 9220', 'RFC 9221', 'W3C WebTransport'],
  },
  lanes: [
    { id: 'client', name: 'ブラウザ', sub: 'new WebTransport()' },
    { id: 'server', name: 'サーバー', sub: 'HTTP/3' },
  ],
  steps: [
    {
      id: 'handshake',
      title: 'QUIC + TLS 1.3 を1往復で',
      hops: [
        { from: 'client', to: 'server', label: 'Initial: ClientHello', kind: 'control' },
        { from: 'server', to: 'client', label: 'Initial + Handshake', kind: 'control' },
        { from: 'client', to: 'server', label: 'Handshake: Finished', kind: 'control' },
      ],
      body:
        'QUICは接続確立と暗号化の鍵交換を同時に行います。TCP + TLS 1.3 なら2往復かかるところが1往復です。\n\n最初のInitialパケットを運ぶUDPデータグラムは1200バイト以上にパディングされます。これも増幅攻撃対策と、経路のMTU確認を兼ねています。',
      packet: {
        name: 'QUIC Initialパケット(ロングヘッダー)',
        layers: ['IPv4', 'UDP', 'QUIC'],
        fields: [
          {
            name: '先頭バイト',
            hex: 'C3',
            desc: 'ロングヘッダー、タイプ=Initial、PN長4バイト',
            bits: [
              { name: 'Header Form', bits: 1, desc: '1 = ロングヘッダー' },
              { name: 'Fixed Bit', bits: 1, desc: '常に1' },
              { name: 'Type', bits: 2, desc: '00 = Initial' },
              { name: 'Reserved', bits: 2, desc: 'ヘッダー保護される' },
              { name: 'PN Length', bits: 2, desc: '値+1 バイト = 4' },
            ],
          },
          { name: 'バージョン', hex: '00 00 00 01', desc: 'QUIC v1' },
          { name: '宛先CID長', hex: '08' },
          { name: '宛先CID', hex: '83 94 C8 F0 3E 51 57 08', desc: '接続ID(RFC 9001 付録A の値)。IPが変わっても接続を識別できる' },
          { name: '送信元CID長', hex: '08' },
          { name: '送信元CID', hex: 'F0 67 A5 50 2A 42 62 B5', desc: '(例)' },
          { name: 'トークン長', hex: '00', desc: 'varint 0。トークンなし' },
          { name: '長さ', hex: '44 9E', desc: '2バイトvarint → 1182(パケット番号+ペイロード)' },
          { name: 'パケット番号', hex: '00 00 00 00', desc: 'ヘッダー保護で隠される' },
          { name: '暗号化ペイロード', hex: '…', desc: 'CRYPTOフレーム(ClientHello)とPADDING' },
        ],
      },
    },
    {
      id: 'connect',
      title: '拡張CONNECTでセッションを開く',
      hops: [
        { from: 'client', to: 'server', label: 'CONNECT webtransport', kind: 'control' },
        { from: 'server', to: 'client', label: ':status 200', kind: 'control' },
      ],
      body:
        'HTTP/3のリクエストで「このストリームをWebTransportセッションにしたい」と頼みます。WebSocketのUpgradeとよく似た発想です。\n\nこのリクエストが流れたストリームのIDが、そのままセッションIDになります。1つのQUIC接続に複数のセッションを相乗りさせることもできます。',
      packet: {
        name: 'HTTP/3 ヘッダー(QPACK展開後)',
        layers: ['IPv4', 'UDP', 'QUIC', 'HTTP/3'],
        view: 'decrypted',
        fields: [
          { name: ':method', text: ':method = CONNECT', lineBreak: true },
          { name: ':protocol', text: ':protocol = webtransport', lineBreak: true, desc: '拡張CONNECTの印' },
          { name: ':scheme', text: ':scheme = https', lineBreak: true },
          { name: ':authority', text: ':authority = game.example.com', lineBreak: true },
          { name: ':path', text: ':path = /play', lineBreak: true },
          { name: 'origin', text: 'origin = https://game.example.com', lineBreak: true, desc: 'サーバーがオリジンを検証する' },
        ],
      },
    },
    {
      id: 'datagram',
      title: 'データグラムで状態を送る',
      hops: [
        { from: 'client', to: 'server', label: 'DATAGRAM: 入力', kind: 'data' },
        { from: 'server', to: 'client', label: 'DATAGRAM: 状態', kind: 'media' },
        { from: 'server', to: 'client', label: 'DATAGRAM: 状態', kind: 'media', lost: true },
        { from: 'server', to: 'client', label: 'DATAGRAM: 状態', kind: 'media' },
      ],
      body:
        'データグラムは再送も順序保証もない、UDPと同じ性質の送信手段です。違いは、暗号化と輻輳制御がついていて、同じ接続の中を通ること。\n\n1つのデータグラムはパケット1つに収まる大きさ(だいたい1200バイト前後)まで。ゲームの入力やスナップショットにちょうどいい道具です。',
      packet: {
        name: '1-RTTパケット(復号後)',
        layers: ['IPv4', 'UDP', 'QUIC', 'DATAGRAM'],
        view: 'decrypted',
        fields: [
          {
            name: '先頭バイト',
            hex: '43',
            desc: 'ショートヘッダー、PN長4バイト',
            bits: [
              { name: 'Header Form', bits: 1, desc: '0 = ショートヘッダー' },
              { name: 'Fixed Bit', bits: 1 },
              { name: 'Spin', bits: 1 },
              { name: 'Reserved', bits: 2 },
              { name: 'Key Phase', bits: 1 },
              { name: 'PN Length', bits: 2, desc: '値+1 バイト = 4' },
            ],
          },
          { name: '宛先CID', hex: '83 94 C8 F0 3E 51 57 08' },
          { name: 'パケット番号', hex: '00 00 00 2A', desc: '42' },
          { name: 'フレーム型', hex: '30', desc: 'DATAGRAM(長さフィールドなし)' },
          { name: 'Quarter Stream ID', hex: '00', desc: 'セッションのストリームID 0 ÷ 4' },
          { name: 'ペイロード', hex: '47 41 4D 45 …', desc: 'ゲームのパケットをそのまま載せられる' },
        ],
      },
    },
    {
      id: 'streams',
      title: '独立したストリームで確実に送る',
      hops: [
        { from: 'client', to: 'server', label: 'stream 4: チャット', kind: 'data' },
        { from: 'server', to: 'client', label: 'stream 3: マップ', kind: 'data' },
      ],
      body:
        'ストリームは順序と到着が保証される通り道です。TCPと違うのは、ストリーム同士が独立していること。マップデータのパケットが落ちても、チャットのストリームは止まりません。\n\n「状態はデータグラム、確実に届けたいものはストリーム」と使い分けるのが基本形です。',
      packet: {
        name: 'STREAMフレーム',
        layers: ['IPv4', 'UDP', 'QUIC', 'STREAM'],
        view: 'decrypted',
        fields: [
          {
            name: 'フレーム型',
            hex: '0A',
            desc: 'STREAM(長さフィールドあり)',
            bits: [
              { name: 'STREAM', bits: 5, desc: '0b00001 = STREAMフレーム群' },
              { name: 'OFF', bits: 1, desc: 'オフセットあり' },
              { name: 'LEN', bits: 1, desc: '長さあり' },
              { name: 'FIN', bits: 1, desc: 'ストリームの終わり' },
            ],
          },
          { name: 'ストリームID', hex: '04', desc: 'クライアントが開いた双方向ストリーム' },
          { name: '長さ', hex: '05' },
          { name: 'WTシグナル', hex: '40 41', desc: 'WebTransportの双方向ストリームの印(varint 0x41)' },
          { name: 'セッションID', hex: '00', desc: 'どのセッションに属するか' },
          { name: 'データ', hex: '68 69', desc: '「hi」' },
        ],
      },
    },
    {
      id: 'migration',
      title: '回線が変わっても切れない',
      hops: [
        { from: 'client', to: 'server', label: 'PATH_CHALLENGE', kind: 'control' },
        { from: 'server', to: 'client', label: 'PATH_RESPONSE', kind: 'control' },
      ],
      body:
        'Wi-Fiからモバイル回線に切り替わると、IPアドレスもポートも変わります。TCPならここで接続が切れ、WebSocketは再接続からやり直しです。\n\nQUICは接続IDで相手を識別するので、新しいアドレスから届いたパケットも同じ接続として扱えます。乗っ取りを防ぐため、新しい経路で本当に受信できるかを乱数の往復で確かめます。',
      packet: {
        name: 'PATH_CHALLENGEフレーム',
        layers: ['IPv4', 'UDP', 'QUIC'],
        view: 'decrypted',
        fields: [
          { name: 'フレーム型', hex: '1A', desc: 'PATH_CHALLENGE' },
          { name: 'データ', hex: '3D 7A 90 E1 05 B2 C8 44', desc: '8バイトの乱数(例)。相手はそのままPATH_RESPONSEで返す' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9000 QUIC', url: 'https://www.rfc-editor.org/rfc/rfc9000' },
    { label: 'RFC 9001 QUIC と TLS', url: 'https://www.rfc-editor.org/rfc/rfc9001' },
    { label: 'RFC 9114 HTTP/3', url: 'https://www.rfc-editor.org/rfc/rfc9114' },
    { label: 'RFC 9220 HTTP/3 の拡張CONNECT', url: 'https://www.rfc-editor.org/rfc/rfc9220' },
    { label: 'RFC 9221 QUIC DATAGRAM', url: 'https://www.rfc-editor.org/rfc/rfc9221' },
    { label: 'RFC 9297 HTTP Datagrams', url: 'https://www.rfc-editor.org/rfc/rfc9297' },
    { label: 'IETF WebTransport over HTTP/3(draft)', url: 'https://datatracker.ietf.org/doc/draft-ietf-webtrans-http3/' },
    { label: 'W3C WebTransport', url: 'https://www.w3.org/TR/webtransport/' },
  ],
  lastVerified: '2026-11-06',
};

export default webtransport;
