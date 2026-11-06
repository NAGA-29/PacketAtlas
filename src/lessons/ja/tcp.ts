import type { BitField, Lesson } from '../types';

const FLAG_BITS: BitField[] = [
  { name: 'CWR', bits: 1 },
  { name: 'ECE', bits: 1 },
  { name: 'URG', bits: 1 },
  { name: 'ACK', bits: 1, desc: '確認応答番号が有効' },
  { name: 'PSH', bits: 1, desc: 'すぐアプリに渡す' },
  { name: 'RST', bits: 1, desc: '強制終了' },
  { name: 'SYN', bits: 1, desc: '接続開始' },
  { name: 'FIN', bits: 1, desc: '送信終わり' },
];

const OFFSET_BITS: BitField[] = [
  { name: 'Data Offset', bits: 4, desc: '32bit単位のヘッダー長' },
  { name: 'Reserved', bits: 4 },
];

const tcp: Lesson = {
  id: 'tcp',
  part: 2,
  order: 2,
  title: 'TCP',
  tagline: '握手し、数え、落ちたら送り直す',
  lead:
    '**バイトの流れを、抜けも重複もなく順番どおりに届けるプロトコル。**送ったバイトに通し番号を振り、相手は「ここまで受け取った」と返します。返事が来なければ送り直し、相手の受け取れる量に合わせて速さを変えます。Web、メール、SSH の土台です。',
  overview: {
    layer: 'トランスポート層(第4層)',
    transport: 'IP(プロトコル番号 6)',
    ports: 'アプリが選ぶ(0〜65535)',
    format: 'バイナリ(ヘッダー20〜60バイト)',
    key: { label: '主なフラグ', value: 'SYN、ACK、FIN、RST、PSH' },
    specs: ['RFC 9293'],
  },
  lanes: [
    { id: 'client', name: 'クライアント', sub: '192.0.2.10:50000' },
    { id: 'server', name: 'サーバー', sub: '203.0.113.80:80' },
  ],
  steps: [
    {
      id: 'syn',
      title: 'SYN:番号の始まりを伝える',
      hops: [{ from: 'client', to: 'server', label: 'SYN seq=0', kind: 'control' }],
      body:
        '接続は SYN から始まります。クライアントは自分のシーケンス番号の初期値(ISN)をランダムに選び、ここから数えると伝えます。推測できる値だと、第三者が偽のパケットを差し込めてしまうからです。\n\n**オプション**で、受け取れる最大の大きさ(MSS)やウィンドウの倍率、SACK を使えるかも伝えます。矢印の `seq=0` は、ISN を0とした相対値です。',
      packet: {
        name: 'TCPヘッダー(SYN)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50', desc: '50000' },
          { name: '宛先ポート', hex: '00 50', desc: '80' },
          { name: 'シーケンス番号', hex: '1A 2B 3C 4D', desc: 'ISN。ランダムに選ぶ(例)' },
          { name: '確認応答番号', hex: '00 00 00 00', desc: 'ACKフラグがないので使わない' },
          { name: 'データオフセット', hex: '80', desc: '8×4 = 32バイト(オプション12バイト込み)', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '02', desc: 'SYN', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: 'FA F0', desc: '64240バイト。SYNでは倍率をかけない' },
          { name: 'チェックサム', hex: '5B AC', desc: '疑似ヘッダー込みの検査値' },
          { name: '緊急ポインタ', hex: '00 00' },
          { name: 'MSS', hex: '02 04 05 B4', desc: '1460バイトまでの区切りで送ってほしい' },
          { name: 'NOP', hex: '01', desc: '次のオプションを4バイト境界にそろえる詰め物' },
          { name: 'ウィンドウスケール', hex: '03 03 07', desc: 'ウィンドウを 2^7 = 128 倍して読む' },
          { name: 'NOP ×2', hex: '01 01' },
          { name: 'SACK許可', hex: '04 02', desc: '飛び飛びの受信を報告してよい' },
        ],
      },
    },
    {
      id: 'syn-ack',
      title: 'SYN-ACK:受け取ったと返し、自分も始める',
      hops: [{ from: 'server', to: 'client', label: 'SYN-ACK ack=1', kind: 'control' }],
      body:
        'サーバーは自分の ISN を選び、同時に確認応答番号を「クライアントの ISN + 1」にします。SYN は1バイト分の番号を使うと決まっているので、次に欲しいのは +1 からです。\n\nSYN と ACK を1つにまとめるので、握手は3回で終わります。',
      packet: {
        name: 'TCPヘッダー(SYN-ACK)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: '00 50' },
          { name: '宛先ポート', hex: 'C3 50' },
          { name: 'シーケンス番号', hex: '5E 6F 70 81', desc: 'サーバーの ISN(例)' },
          { name: '確認応答番号', hex: '1A 2B 3C 4E', desc: 'クライアントの ISN + 1' },
          { name: 'データオフセット', hex: '80', desc: '32バイト', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '12', desc: 'SYN + ACK', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: 'FE 88', desc: '65160バイト' },
          { name: 'チェックサム', hex: '89 12' },
          { name: '緊急ポインタ', hex: '00 00' },
          { name: 'MSS', hex: '02 04 05 B4', desc: '1460' },
          { name: 'NOP', hex: '01' },
          { name: 'ウィンドウスケール', hex: '03 03 07', desc: 'サーバー側も128倍' },
          { name: 'NOP ×2', hex: '01 01' },
          { name: 'SACK許可', hex: '04 02', desc: '両方が送ったので SACK が使える' },
        ],
      },
    },
    {
      id: 'ack',
      title: 'ACK:握手の完了',
      hops: [{ from: 'client', to: 'server', label: 'ACK ack=1', kind: 'control' }],
      body:
        'クライアントが「サーバーの ISN + 1」を確認して、3ウェイハンドシェイクが終わります。ここまでで1往復(1 RTT)。この ACK には、もうデータを載せてもかまいません。\n\nオプションがなくなり、ヘッダーは最小の20バイトです。ウィンドウ欄の502は、倍率128をかけて64256バイトと読みます。',
      packet: {
        name: 'TCPヘッダー(ACK)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50' },
          { name: '宛先ポート', hex: '00 50' },
          { name: 'シーケンス番号', hex: '1A 2B 3C 4E', desc: '相対値 1' },
          { name: '確認応答番号', hex: '5E 6F 70 82', desc: 'サーバーの ISN + 1' },
          { name: 'データオフセット', hex: '50', desc: '20バイト', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '10', desc: 'ACK', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: '01 F6', desc: '502 × 128 = 64256バイト' },
          { name: 'チェックサム', hex: 'C6 77' },
          { name: '緊急ポインタ', hex: '00 00' },
        ],
      },
    },
    {
      id: 'data',
      title: 'データを送り、ACKで受け取りを知る',
      hops: [
        { from: 'client', to: 'server', label: 'seq=1「hello」', kind: 'data' },
        { from: 'server', to: 'client', label: 'ACK ack=6', kind: 'control' },
      ],
      body:
        '5バイトの「hello」を送ります。シーケンス番号は先頭バイトの番号なので、次は 1 + 5 = 6 から。サーバーは `ack=6` を返して「5番までは受け取った」と伝えます。\n\nACKは「次に欲しい番号」で、受け取った分をまとめて確認します。届くまで、送った側はデータを手元に残しておきます。',
      packet: {
        name: 'TCPセグメント(データ)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50' },
          { name: '宛先ポート', hex: '00 50' },
          { name: 'シーケンス番号', hex: '1A 2B 3C 4E', desc: '相対値 1。このデータの先頭バイトの番号' },
          { name: '確認応答番号', hex: '5E 6F 70 82' },
          { name: 'データオフセット', hex: '50', desc: '20バイト', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '18', desc: 'PSH + ACK', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: '01 F6' },
          { name: 'チェックサム', hex: '82 98', desc: 'データも含めて計算する' },
          { name: '緊急ポインタ', hex: '00 00' },
          { name: 'データ', hex: '68 65 6C 6C 6F', desc: '「hello」' },
        ],
      },
    },
    {
      id: 'retransmit',
      title: '落ちたら送り直す',
      hops: [
        { from: 'client', to: 'server', label: 'seq=6 1460B', kind: 'data', lost: true },
        { from: 'client', to: 'server', label: 'seq=1466 1460B', kind: 'data' },
        { from: 'server', to: 'client', label: 'ACK 6 + SACK', kind: 'control' },
        { from: 'client', to: 'server', label: 'seq=6 再送', kind: 'data' },
        { from: 'server', to: 'client', label: 'ACK ack=2926', kind: 'control' },
      ],
      body:
        '6番からの1460バイトが落ちました。後ろの 1466番からは届いたので、サーバーは `ack=6` を繰り返しつつ、SACK で「1466〜2925 は持っている」と知らせます。同じACKが3回続くと、クライアントはタイマーを待たずに欠けた分だけ送り直します(高速再送)。\n\n再送が届くと、確認応答は一気に 2926 まで進みます。ただし、それまで 1466番以降のデータはアプリに渡せません。これが**ヘッドオブラインブロッキング**です。',
      packet: {
        name: '重複ACK(SACKオプション付き)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: '00 50' },
          { name: '宛先ポート', hex: 'C3 50' },
          { name: 'シーケンス番号', hex: '5E 6F 70 82' },
          { name: '確認応答番号', hex: '1A 2B 3C 53', desc: '相対値 6。まだ6番が欲しい' },
          { name: 'データオフセット', hex: '80', desc: '32バイト', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '10', desc: 'ACK', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: '01 FD', desc: '509 × 128' },
          { name: 'チェックサム', hex: 'D2 3B' },
          { name: '緊急ポインタ', hex: '00 00' },
          { name: 'NOP ×2', hex: '01 01' },
          { name: 'SACK', hex: '05 0A', desc: '種別5、長さ10(ブロック1つ)' },
          { name: 'SACK 左端', hex: '1A 2B 42 07', desc: '相対値 1466。ここから' },
          { name: 'SACK 右端', hex: '1A 2B 47 BB', desc: '相対値 2926。この手前まで受信済み' },
        ],
      },
    },
    {
      id: 'window',
      title: '受け取れる量に合わせて止める',
      hops: [
        { from: 'server', to: 'client', label: 'ACK win=0', kind: 'control' },
        { from: 'client', to: 'client', label: '送信を止める', kind: 'control' },
        { from: 'client', to: 'server', label: 'ウィンドウ確認', kind: 'control' },
        { from: 'server', to: 'client', label: 'ACK win=502', kind: 'control' },
      ],
      body:
        'サーバーのアプリが読み出しに追いつかず、受信バッファが一杯になりました。ウィンドウを0にして「今は受け取れない」と伝えると、クライアントは送るのを止めます(フロー制御)。\n\n止まったままにならないよう、クライアントはときどき小さな確認を送ります。空きができたら、サーバーは広がったウィンドウを返します。回線の混み具合に合わせる**輻輳制御**は、これとは別に送る側が自分で行います。',
      packet: {
        name: 'TCPヘッダー(ゼロウィンドウ)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: '00 50' },
          { name: '宛先ポート', hex: 'C3 50' },
          { name: 'シーケンス番号', hex: '5E 6F 70 82' },
          { name: '確認応答番号', hex: '1A 2B 47 BB', desc: '相対値 2926。再送分まで全部受け取った' },
          { name: 'データオフセット', hex: '50', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '10', desc: 'ACK', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: '00 00', desc: '0。これ以上送らないで' },
          { name: 'チェックサム', hex: 'BD 00' },
          { name: '緊急ポインタ', hex: '00 00' },
        ],
      },
    },
    {
      id: 'fin',
      title: 'FINで片方ずつ閉じる',
      hops: [
        { from: 'client', to: 'server', label: 'FIN', kind: 'control' },
        { from: 'server', to: 'client', label: 'ACK', kind: 'control' },
        { from: 'server', to: 'client', label: 'FIN', kind: 'control' },
        { from: 'client', to: 'server', label: 'ACK', kind: 'control' },
      ],
      body:
        'TCPの接続は2本の一方通行の組です。FIN は「こちらから送るものはもうない」という意味で、受け取る側はまだ送り続けられます。両方が FIN を送り、互いに ACK して閉じ終わります。\n\n最後に ACK した側はしばらく TIME-WAIT で待ちます。その ACK が落ちて FIN が再送されてきたときに応え、古いパケットが次の接続に紛れ込むのを防ぐためです。',
      packet: {
        name: 'TCPヘッダー(FIN)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50' },
          { name: '宛先ポート', hex: '00 50' },
          { name: 'シーケンス番号', hex: '1A 2B 47 BB', desc: '相対値 2926。FIN も1つ番号を使う' },
          { name: '確認応答番号', hex: '5E 6F 70 82' },
          { name: 'データオフセット', hex: '50', bits: OFFSET_BITS },
          { name: 'フラグ', hex: '11', desc: 'FIN + ACK', bits: FLAG_BITS },
          { name: 'ウィンドウ', hex: '01 F6' },
          { name: 'チェックサム', hex: 'BB 09' },
          { name: '緊急ポインタ', hex: '00 00' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9293 Transmission Control Protocol', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
    { label: 'RFC 7323 TCP Extensions for High Performance(ウィンドウスケール)', url: 'https://www.rfc-editor.org/rfc/rfc7323' },
    { label: 'RFC 2018 TCP Selective Acknowledgment Options', url: 'https://www.rfc-editor.org/rfc/rfc2018' },
    { label: 'RFC 5681 TCP Congestion Control', url: 'https://www.rfc-editor.org/rfc/rfc5681' },
    { label: 'RFC 6528 Defending against Sequence Number Attacks', url: 'https://www.rfc-editor.org/rfc/rfc6528' },
  ],
  lastVerified: '2026-11-06',
};

export default tcp;
