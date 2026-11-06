import type { Lesson } from '../types';

const udp: Lesson = {
  id: 'udp',
  part: 2,
  order: 1,
  title: 'UDP',
  tagline: '8バイトのヘッダーだけで送りっぱなし',
  lead:
    '**宛先のポート番号を付けて、データをそのまま送るだけのプロトコル。**接続の準備も、届いたかの確認も、順番の並べ直しもしません。その分ヘッダーは8バイトと小さく、すぐに送れます。DNS、音声通話、ゲーム、QUIC の土台です。',
  lanes: [
    { id: 'client', name: 'クライアント', sub: '192.0.2.10:50000' },
    { id: 'server', name: 'サーバー', sub: '203.0.113.7:9000' },
  ],
  steps: [
    {
      id: 'send',
      title: 'いきなり送る',
      hops: [{ from: 'client', to: 'server', label: 'UDP「ping」', kind: 'data' }],
      body:
        'UDPには接続の手続きがありません。ソケットを作ったら、最初のパケットからいきなりデータを載せて送れます。\n\nヘッダーは送信元ポート、宛先ポート、長さ、チェックサムの4つだけで、それぞれ2バイトです。',
      packet: {
        name: 'UDPデータグラム',
        layers: ['IPv4', 'UDP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50', desc: '50000。返事はここに返ってくる' },
          { name: '宛先ポート', hex: '23 28', desc: '9000。サーバーのアプリが待っている番号' },
          { name: '長さ', hex: '00 0C', desc: 'ヘッダー8 + データ4 = 12バイト' },
          { name: 'チェックサム', hex: '3C 7A', desc: '疑似ヘッダー・ヘッダー・データの1の補数和(手順6)' },
          { name: 'データ', hex: '70 69 6E 67', desc: '「ping」' },
        ],
      },
    },
    {
      id: 'ip',
      title: 'IPヘッダーに包まれて運ばれる',
      hops: [{ from: 'client', to: 'server', label: 'IPv4 + UDP', kind: 'data' }],
      body:
        '実際に回線を流れるのは、UDPデータグラムの前にIPヘッダーが付いたものです。IPが「どのホストへ」、UDPのポートが「そのホストのどのアプリへ」を受け持ちます。\n\nプロトコル番号 17 が「中身はUDP」という印です。TCPなら 6 になります。',
      packet: {
        name: 'IPv4ヘッダー',
        layers: ['IPv4'],
        fields: [
          {
            name: 'バージョン + ヘッダー長',
            hex: '45',
            desc: 'IPv4、ヘッダー長 5×4 = 20バイト',
            bits: [
              { name: 'Version', bits: 4, desc: '4' },
              { name: 'IHL', bits: 4, desc: '32bit単位のヘッダー長' },
            ],
          },
          { name: 'サービス種別', hex: '00', desc: 'DSCP と ECN。ここでは指定なし' },
          { name: '全長', hex: '00 20', desc: 'IPヘッダー20 + UDP 12 = 32バイト' },
          { name: '識別子', hex: '1C 46', desc: '分割されたときに断片をまとめる番号(例)' },
          {
            name: 'フラグ + 断片位置',
            hex: '40 00',
            desc: 'DF=1(分割禁止)',
            bits: [
              { name: '予約', bits: 1 },
              { name: 'DF', bits: 1, desc: '分割禁止' },
              { name: 'MF', bits: 1, desc: '続きの断片あり' },
              { name: 'Fragment Offset', bits: 13, desc: '8バイト単位の位置' },
            ],
          },
          { name: 'TTL', hex: '40', desc: '64。ルーターを1つ越えるごとに1減る' },
          { name: 'プロトコル', hex: '11', desc: '17 = UDP' },
          { name: 'ヘッダーチェックサム', hex: '20 75', desc: 'IPヘッダーだけの検査値' },
          { name: '送信元アドレス', hex: 'C0 00 02 0A', desc: '192.0.2.10' },
          { name: '宛先アドレス', hex: 'CB 00 71 07', desc: '203.0.113.7' },
        ],
      },
    },
    {
      id: 'reply',
      title: '返事もただのデータグラム',
      hops: [{ from: 'server', to: 'client', label: 'UDP「pong」', kind: 'data' }],
      body:
        'サーバーは受け取ったデータグラムの送信元アドレスとポートを見て、そこへ返します。UDPにとって「返事」という特別な仕組みはなく、向きが逆なだけの別のデータグラムです。\n\nポートが入れ替わっているだけで、長さは同じ12バイトです。',
      packet: {
        name: 'UDPデータグラム(返事)',
        layers: ['IPv4', 'UDP'],
        fields: [
          { name: '送信元ポート', hex: '23 28', desc: '9000' },
          { name: '宛先ポート', hex: 'C3 50', desc: '50000' },
          { name: '長さ', hex: '00 0C', desc: '12バイト' },
          { name: 'チェックサム', hex: '3C 74' },
          { name: 'データ', hex: '70 6F 6E 67', desc: '「pong」' },
        ],
      },
    },
    {
      id: 'loss',
      title: '落ちても誰も気づかない',
      hops: [
        { from: 'client', to: 'server', label: '#1', kind: 'data', lost: true },
        { from: 'client', to: 'server', label: '#2', kind: 'data' },
      ],
      body:
        '#1 は途中のルーターで捨てられました。UDPには確認応答も再送もないので、送った側も受け取る側も、UDPの層では何も知りません。\n\n気づく必要があるなら、アプリが自分で番号を振ります。ここでは先頭4バイトを通し番号にしたので、受信側は「#1 が欠けた」と分かります。',
      packet: {
        name: 'UDPデータグラム(#2)',
        layers: ['IPv4', 'UDP', 'アプリ'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50' },
          { name: '宛先ポート', hex: '23 28' },
          { name: '長さ', hex: '00 10', desc: '8 + 8 = 16バイト' },
          { name: 'チェックサム', hex: '37 6C' },
          { name: 'アプリの通し番号', hex: '00 00 00 02', desc: 'UDPではなくアプリが決めた形式' },
          { name: 'データ', hex: '6D 6F 76 65', desc: '「move」' },
        ],
      },
    },
    {
      id: 'reorder',
      title: '順番が入れ替わることもある',
      hops: [
        { from: 'server', to: 'client', label: '#4', kind: 'data' },
        { from: 'server', to: 'client', label: '#3', kind: 'data' },
      ],
      body:
        '経路の途中で別々の道を通ると、後から送った #4 が先に着くことがあります。UDPはそのまま渡すので、並べ直すかどうかはアプリ次第です。\n\n最新の状態だけが大事なアプリ(ゲームの位置など)は、古い #3 を捨てます。音声なら短いバッファで並べ直してから再生します。',
      packet: {
        name: '受信側アプリの判断',
        note: 'ネットワークには流れない、受信側アプリの処理です。',
        fields: [
          { name: '1つ目に到着', text: '#4 → 最新として使う', lineBreak: true },
          { name: '2つ目に到着', text: '#3 → #4 より古いので捨てる', lineBreak: true, desc: 'ゲームの状態同期の場合' },
          { name: '音声なら', text: '#3, #4 の順に並べ直して再生', lineBreak: true, desc: 'ジッターバッファで少し待つ' },
        ],
      },
    },
    {
      id: 'checksum',
      title: 'チェックサムで壊れを見つける',
      hops: [{ from: 'server', to: 'server', label: '検査値を確かめる', kind: 'control' }],
      body:
        'チェックサムは、UDPヘッダーとデータに、IPアドレスなどを並べた**疑似ヘッダー**を足して計算します。宛先の違うパケットを誤って受け取らないよう、アドレスも検査の対象にするためです。\n\n16bitずつ1の補数で足し、最後に反転した値が入ります。受信側が同じ計算をして、結果が合わなければ黙って捨てます。',
      packet: {
        name: '疑似ヘッダー(手順1のデータグラム用)',
        note: '疑似ヘッダーは計算のためだけに並べるもので、実際には送られません。この後ろに手順1のUDPヘッダーとデータが続きます。',
        fields: [
          { name: '送信元アドレス', hex: 'C0 00 02 0A', desc: '192.0.2.10' },
          { name: '宛先アドレス', hex: 'CB 00 71 07', desc: '203.0.113.7' },
          { name: 'ゼロ', hex: '00' },
          { name: 'プロトコル', hex: '11', desc: '17 = UDP' },
          { name: 'UDPの長さ', hex: '00 0C', desc: '12バイト' },
        ],
      },
    },
    {
      id: 'unreachable',
      title: '誰も待っていないポートに送ると',
      hops: [
        { from: 'client', to: 'server', label: 'UDP → :9001', kind: 'data' },
        { from: 'server', to: 'client', label: 'ICMP 到達不能', kind: 'control' },
      ],
      body:
        'ポート 9001 では誰も待っていませんでした。UDPには断る仕組みがないので、代わりにIPの側から ICMP の「ポート到達不能」が返ってきます。\n\nICMPには原因になったパケットのIPヘッダーと先頭8バイト(ちょうどUDPヘッダー)が入っていて、送った側はどの通信の話かを突き止められます。ただしファイアウォールがICMPを捨てることも多く、何も返ってこないこともあります。',
      packet: {
        name: 'ICMP Destination Unreachable',
        layers: ['IPv4', 'ICMP'],
        fields: [
          { name: 'タイプ', hex: '03', desc: '3 = 宛先到達不能' },
          { name: 'コード', hex: '03', desc: '3 = ポート到達不能' },
          { name: 'チェックサム', hex: 'D9 FD', desc: 'ICMPメッセージ全体の検査値' },
          { name: '未使用', hex: '00 00 00 00' },
          { name: '元のIPヘッダー', hex: '45 00 00 20 1C 47 40 00 38 11 28 74 C0 00 02 0A CB 00 71 07', desc: 'サーバーに届いた時点のIPヘッダー。TTLは経路で 64 → 56 に減り、ヘッダーチェックサムも計算し直されている' },
          { name: '元のUDPヘッダー', hex: 'C3 50 23 29 00 0C 3C 79', desc: '50000 → 9001。どの通信かが分かる' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 768 User Datagram Protocol', url: 'https://www.rfc-editor.org/rfc/rfc768' },
    { label: 'RFC 791 Internet Protocol', url: 'https://www.rfc-editor.org/rfc/rfc791' },
    { label: 'RFC 792 ICMP', url: 'https://www.rfc-editor.org/rfc/rfc792' },
    { label: 'RFC 1071 Computing the Internet Checksum', url: 'https://www.rfc-editor.org/rfc/rfc1071' },
    { label: 'RFC 8085 UDP Usage Guidelines', url: 'https://www.rfc-editor.org/rfc/rfc8085' },
  ],
  lastVerified: '2026-11-06',
};

export default udp;
