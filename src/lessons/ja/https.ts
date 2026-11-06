import type { Lesson, Packet } from '../types';
import tls13 from './tls13';
import http11 from './http11';

/** 他のレッスンのパケットをそのまま使う(同じバイト列を二重に持たない) */
const borrow = (lesson: { id: string; steps: { id: string; packet?: Packet }[] }, stepId: string): Packet => {
  const p = lesson.steps.find((s) => s.id === stepId)?.packet;
  if (!p) throw new Error(`${lesson.id}#${stepId} has no packet`);
  return p;
};

const response = borrow(http11, 'response');

const https: Lesson = {
  id: 'https',
  part: 4,
  order: 2,
  title: 'HTTPS(通し)',
  tagline: 'DNS→TCP→TLS→HTTP をひと続きで見る',
  lead:
    '**アドレスバーに `https://example.com/` と打ってから最初の1バイトが届くまでを、ひと続きで追います。**これまでの章で見た DNS・TCP・TLS・HTTP が順に使われ、そのたびに往復(RTT)が積み上がります。速いサイトを作るとは、この往復を減らすことです。',
  overview: {
    layer: 'アプリケーション層(DNS・TCP・TLS・HTTP の組み合わせ)',
    transport: 'TCP + TLS',
    ports: '443',
    format: '外からは TLS のレコードだけが見える',
    key: { label: '使うプロトコル', value: 'DNS、TCP、TLS 1.3、HTTP/1.1' },
    specs: ['RFC 9110', 'RFC 8446'],
  },
  lanes: [
    { id: 'browser', name: 'ブラウザ', sub: '192.0.2.10' },
    { id: 'resolver', name: 'リゾルバー', sub: '198.51.100.53' },
    { id: 'server', name: 'サーバー', sub: '203.0.113.80:443' },
  ],
  steps: [
    {
      id: 'dns',
      title: '1. 名前を引く(DNS)',
      hops: [
        { from: 'browser', to: 'resolver', label: 'example.com A?', kind: 'signal' },
        { from: 'resolver', to: 'browser', label: 'A 203.0.113.80', kind: 'signal' },
      ],
      body:
        'まずサーバーのIPアドレスが要ります。リゾルバーのキャッシュにあれば、リゾルバーまでの1往復で済みます。なければ DNS の章で見たように、ルートから順にたどる分だけ遅くなります。\n\nブラウザやOSも結果をキャッシュするので、2回目以降はこの手順ごと省かれることが多いです。',
      packet: {
        name: 'DNS応答(リゾルバー → ブラウザ)',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '2C 61', desc: '(例)' },
          { name: 'フラグ', hex: '81 80', desc: 'QR=1、RD=1、RA=1' },
          { name: '件数', hex: '00 01 00 01 00 00 00 00', desc: '質問1、回答1' },
          { name: '質問:名前', hex: '07 65 78 61 6D 70 6C 65 03 63 6F 6D 00', desc: 'example.com' },
          { name: '質問:タイプ・クラス', hex: '00 01 00 01', desc: 'A、IN' },
          { name: '回答', hex: 'C0 0C 00 01 00 01 00 00 0E 10 00 04 CB 00 71 50', desc: 'example.com は 203.0.113.80、TTL 3600' },
        ],
      },
    },
    {
      id: 'tcp',
      title: '2. TCP接続を張る',
      hops: [
        { from: 'browser', to: 'server', label: 'SYN', kind: 'control' },
        { from: 'server', to: 'browser', label: 'SYN-ACK', kind: 'control' },
        { from: 'browser', to: 'server', label: 'ACK', kind: 'control' },
      ],
      body:
        'サーバーの443番にTCPの3ウェイハンドシェイクで1往復。ここまでで合計2往復です。\n\n最後の ACK を送ったらすぐ次に進めるので、3つ目の矢印は待ち時間に数えません。',
      packet: {
        name: 'TCPヘッダー(SYN、443番へ)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 52', desc: '50002' },
          { name: '宛先ポート', hex: '01 BB', desc: '443 = HTTPS' },
          { name: 'シーケンス番号', hex: '7C 1D 2E 3F', desc: 'ISN(例)' },
          { name: '確認応答番号', hex: '00 00 00 00' },
          { name: 'データオフセット + フラグ', hex: '80 02', desc: '32バイト、SYN' },
          { name: 'ウィンドウ', hex: 'FA F0', desc: '64240' },
          { name: 'チェックサム', hex: '06 5B' },
          { name: '緊急ポインタ', hex: '00 00' },
          { name: 'オプション', hex: '02 04 05 B4 01 03 03 07 01 01 04 02', desc: 'MSS 1460、ウィンドウスケール 7、SACK許可' },
        ],
      },
    },
    {
      id: 'tls',
      title: '3. TLS 1.3 のハンドシェイク',
      hops: [
        { from: 'browser', to: 'server', label: 'ClientHello', kind: 'control' },
        { from: 'server', to: 'browser', label: 'ServerHello … Finished', kind: 'control' },
      ],
      body:
        'ClientHello に鍵共有を入れ、サーバーは ServerHello から Finished までを一度に返します。TLS 1.3 なのでここは1往復。合計3往復です。\n\nこのパケットは TLS 1.3 の章の ClientHello と同じものです。`server_name` に入った `example.com` で、サーバーはどの証明書を出すかを決めます。',
      packet: borrow(tls13, 'client-hello'),
    },
    {
      id: 'request',
      title: '4. Finished と一緒にリクエスト',
      hops: [
        { from: 'browser', to: 'server', label: 'Finished', kind: 'control' },
        { from: 'browser', to: 'server', label: 'GET /', kind: 'data' },
      ],
      body:
        'ブラウザは自分の Finished を送ったら、返事を待たずに続けて HTTP のリクエストを送ります。外から見えるのは、長さだけが分かる暗号化されたレコードです。\n\nこの54バイトの中に、HTTP/1.1 の章で見た `GET / HTTP/1.1` のリクエストが入っています。',
      packet: borrow(tls13, 'application-data'),
    },
    {
      id: 'response',
      title: '5. レスポンスが届く',
      hops: [{ from: 'server', to: 'browser', label: '200 OK', kind: 'data' }],
      body:
        'サーバーがHTMLを返します。リクエストを送ってから1往復で、合計4往復目に最初の1バイトが届きました(**TTFB**)。\n\nブラウザはHTMLを読み、CSSや画像を同じ接続で続けて頼みます。そこから先は HTTP/2 の多重化が効いてきます。',
      packet: {
        ...response,
        name: 'HTTPレスポンス(復号後)',
        layers: ['IPv4', 'TCP', 'TLS', 'HTTP/1.1'],
        view: 'decrypted',
      },
    },
    {
      id: 'total',
      title: '往復を数える',
      hops: [{ from: 'browser', to: 'browser', label: '合計 4 RTT', kind: 'control' }],
      body:
        'DNS 1、TCP 1、TLS 1、HTTP 1 で4往復。サーバーまでのRTTが50msなら、計算以外の待ち時間だけで200msです。\n\n減らす方法は層ごとにあります。DNSのキャッシュ、接続の使い回し、TLSの再開(0-RTT)、そしてTCPとTLSの往復をまとめた HTTP/3(QUIC)です。',
      packet: {
        name: '往復の内訳(RTT 50ms の例)',
        note: 'ネットワークには流れない、待ち時間の計算です。',
        fields: [
          { name: 'DNS', text: '1 RTT(リゾルバーまで)', lineBreak: true, desc: 'キャッシュがあれば0' },
          { name: 'TCP', text: '1 RTT', lineBreak: true },
          { name: 'TLS 1.3', text: '1 RTT', lineBreak: true, desc: '再開して 0-RTT なら0' },
          { name: 'HTTP', text: '1 RTT', lineBreak: true },
          { name: '合計', text: '4 RTT ≒ 200ms', lineBreak: true, desc: 'HTTP/3 なら TCP と TLS がまとまって3 RTT' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9110 HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
    { label: 'RFC 8446 TLS 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
    { label: 'RFC 9293 TCP', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
    { label: 'RFC 1035 DNS', url: 'https://www.rfc-editor.org/rfc/rfc1035' },
  ],
  lastVerified: '2026-11-06',
};

export default https;
