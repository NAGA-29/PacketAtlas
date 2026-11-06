import type { BitField, Field, Lesson } from '../types';

const FLAG_BITS: BitField[] = [
  { name: 'QR', bits: 1, desc: '0=問い合わせ 1=応答' },
  { name: 'Opcode', bits: 4, desc: '0=通常の問い合わせ' },
  { name: 'AA', bits: 1, desc: '権威ある応答' },
  { name: 'TC', bits: 1, desc: '切り詰められた' },
  { name: 'RD', bits: 1, desc: '再帰を希望' },
  { name: 'RA', bits: 1, desc: '再帰できる' },
  { name: 'Z', bits: 1 },
  { name: 'AD', bits: 1, desc: 'DNSSEC検証済み' },
  { name: 'CD', bits: 1, desc: '検証しないで' },
  { name: 'RCODE', bits: 4, desc: '結果コード' },
];

/** www.example.com の問い合わせ部分(オフセット12から) */
const question = (name = 'www.example.com'): Field[] => [
  name === 'www.example.com'
    ? { name: '名前', hex: '03 77 77 77 07 65 78 61 6D 70 6C 65 03 63 6F 6D 00', desc: '「3 www 7 example 3 com 0」。長さ付きのラベルを並べ、0で終わる' }
    : { name: '名前', hex: '04 77 77 77 77 07 65 78 61 6D 70 6C 65 03 63 6F 6D 00', desc: '「4 wwww 7 example 3 com 0」' },
  { name: 'タイプ', hex: '00 01', desc: 'A(IPv4アドレス)' },
  { name: 'クラス', hex: '00 01', desc: 'IN(インターネット)' },
];

const counts = (qd: string, an: string, ns: string, ar: string): Field[] => [
  { name: '質問数', hex: qd },
  { name: '回答数', hex: an },
  { name: '権威数', hex: ns },
  { name: '追加数', hex: ar },
];

const dns: Lesson = {
  id: 'dns',
  part: 3,
  order: 1,
  title: 'DNS',
  tagline: 'ルートから順に名前をたどる',
  lead:
    '**名前をIPアドレスに変える、世界規模の分散データベース。**手元の端末はリゾルバーに1回聞くだけですが、リゾルバーはルート、TLD、権威サーバーへと順にたどって答えを探します。答えはしばらくキャッシュされ、2回目からはすぐ返ります。',
  overview: {
    layer: 'アプリケーション層',
    transport: 'UDP(大きい応答は TCP)',
    ports: '53',
    format: 'バイナリ(ヘッダー12バイト + 質問・回答・権威・追加)',
    key: { label: '主なレコード', value: 'A、AAAA、NS、CNAME、MX、SOA' },
    specs: ['RFC 1034', 'RFC 1035'],
  },
  lanes: [
    { id: 'stub', name: '端末', sub: '192.0.2.10' },
    { id: 'resolver', name: 'リゾルバー', sub: '198.51.100.53' },
    { id: 'root', name: 'ルート', sub: '「.」' },
    { id: 'tld', name: 'TLD', sub: '「com.」' },
    { id: 'auth', name: '権威', sub: 'ns1.example.com' },
  ],
  steps: [
    {
      id: 'query',
      title: '端末がリゾルバーに聞く',
      hops: [{ from: 'stub', to: 'resolver', label: 'www.example.com A?', kind: 'signal' }],
      body:
        'ブラウザが `www.example.com` を開こうとすると、OSは設定されたリゾルバーにUDPの53番で問い合わせます。**RD**(再帰を希望)を立てて「最後まで調べて答えだけちょうだい」と頼みます。\n\nIDは16bitの乱数で、応答との対応づけに使います。推測されにくいほど、偽の応答を差し込まれにくくなります。',
      packet: {
        name: 'DNS問い合わせ',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '3A 7C', desc: '乱数(例)。応答に同じ値が入る' },
          { name: 'フラグ', hex: '01 00', desc: 'RD=1(再帰を希望)', bits: FLAG_BITS },
          ...counts('00 01', '00 00', '00 00', '00 00'),
          ...question(),
        ],
      },
    },
    {
      id: 'root',
      title: 'リゾルバーがルートに聞く',
      hops: [
        { from: 'resolver', to: 'root', label: 'www.example.com A?', kind: 'signal' },
        { from: 'root', to: 'resolver', label: 'com. はあちら', kind: 'signal' },
      ],
      body:
        'キャッシュに何もなければ、リゾルバーはルートサーバーから始めます。ルートサーバーのアドレスは、あらかじめリゾルバーに組み込まれています。\n\nリゾルバー同士の問い合わせは RD=0 です。ルートは答えを知らないので「`com.` のことは、これらのTLDサーバーに聞いて」と**委任**を返します。',
      packet: {
        name: 'DNS問い合わせ(リゾルバー → ルート)',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '9B 21', desc: '端末とのやり取りとは別の乱数(例)' },
          { name: 'フラグ', hex: '00 00', desc: 'RD=0。自分でたどるので再帰は頼まない', bits: FLAG_BITS },
          ...counts('00 01', '00 00', '00 00', '00 00'),
          ...question(),
        ],
      },
    },
    {
      id: 'tld',
      title: 'TLDが権威サーバーを教える',
      hops: [
        { from: 'resolver', to: 'tld', label: 'www.example.com A?', kind: 'signal' },
        { from: 'tld', to: 'resolver', label: 'example.com はあちら', kind: 'signal' },
      ],
      body:
        '`com.` のTLDサーバーも答えは持っていません。代わりに `example.com` を管理する権威サーバーの名前(NS)と、そのアドレス(**グルー**)を返します。グルーがないと、`ns1.example.com` を引くためにまた `example.com` を聞く、という堂々巡りになるからです。\n\n名前の繰り返しは**圧縮ポインター**で省きます。`C0 10` は「メッセージの先頭から16バイト目の名前を見よ」という意味です。',
      packet: {
        name: '委任の応答(TLD → リゾルバー)',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '4E 07', desc: 'リゾルバーが送った問い合わせのID(例)' },
          { name: 'フラグ', hex: '80 00', desc: 'QR=1。AA=0 なので権威ある答えではない', bits: FLAG_BITS },
          ...counts('00 01', '00 00', '00 01', '00 01'),
          ...question(),
          { name: '権威:名前', hex: 'C0 10', desc: 'ポインター → オフセット16の「example.com」' },
          { name: '権威:タイプ・クラス', hex: '00 02 00 01', desc: 'NS、IN' },
          { name: '権威:TTL', hex: '00 02 A3 00', desc: '172800秒 = 2日' },
          { name: '権威:データ長', hex: '00 06' },
          { name: '権威:NS', hex: '03 6E 73 31 C0 10', desc: '「ns1」+ ポインター → ns1.example.com' },
          { name: '追加:名前', hex: 'C0 2D', desc: 'ポインター → オフセット45の「ns1.example.com」' },
          { name: '追加:タイプ・クラス', hex: '00 01 00 01', desc: 'A、IN' },
          { name: '追加:TTL', hex: '00 02 A3 00', desc: '172800秒' },
          { name: '追加:データ長', hex: '00 04' },
          { name: '追加:アドレス', hex: 'C6 33 64 01', desc: '198.51.100.1(グルー)' },
        ],
      },
    },
    {
      id: 'authoritative',
      title: '権威サーバーが答える',
      hops: [
        { from: 'resolver', to: 'auth', label: 'www.example.com A?', kind: 'signal' },
        { from: 'auth', to: 'resolver', label: 'A 203.0.113.80', kind: 'signal' },
      ],
      body:
        '`ns1.example.com`(198.51.100.1)は `example.com` のデータを持っている本人です。**AA**(権威ある応答)を立てて、Aレコードを返します。\n\n**TTL** の3600は「この答えは1時間キャッシュしてよい」という意味です。管理者は、変更の予定があればTTLを短くしておきます。',
      packet: {
        name: '権威ある応答',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '7D 3E', desc: '(例)' },
          { name: 'フラグ', hex: '84 00', desc: 'QR=1、AA=1', bits: FLAG_BITS },
          ...counts('00 01', '00 01', '00 00', '00 00'),
          ...question(),
          { name: '回答:名前', hex: 'C0 0C', desc: 'ポインター → オフセット12(質問の名前)' },
          { name: '回答:タイプ・クラス', hex: '00 01 00 01', desc: 'A、IN' },
          { name: '回答:TTL', hex: '00 00 0E 10', desc: '3600秒' },
          { name: '回答:データ長', hex: '00 04' },
          { name: '回答:アドレス', hex: 'CB 00 71 50', desc: '203.0.113.80' },
        ],
      },
    },
    {
      id: 'answer',
      title: 'リゾルバーが端末に返す',
      hops: [{ from: 'resolver', to: 'stub', label: 'A 203.0.113.80', kind: 'signal' }],
      body:
        'リゾルバーは答えをキャッシュに入れてから、端末に返します。IDは端末が最初に送った `3A 7C` で、**RA**(再帰できる)が立っています。\n\nたどった過程は端末には見えません。AA も立たないのは、リゾルバーが権威ではなく「代わりに調べた人」だからです。',
      packet: {
        name: 'DNS応答(リゾルバー → 端末)',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '3A 7C', desc: '手順1の問い合わせと同じ' },
          { name: 'フラグ', hex: '81 80', desc: 'QR=1、RD=1、RA=1、RCODE=0', bits: FLAG_BITS },
          ...counts('00 01', '00 01', '00 00', '00 00'),
          ...question(),
          { name: '回答:名前', hex: 'C0 0C' },
          { name: '回答:タイプ・クラス', hex: '00 01 00 01' },
          { name: '回答:TTL', hex: '00 00 0E 10', desc: '3600秒' },
          { name: '回答:データ長', hex: '00 04' },
          { name: '回答:アドレス', hex: 'CB 00 71 50', desc: '203.0.113.80' },
        ],
      },
    },
    {
      id: 'cache',
      title: '2回目はキャッシュから',
      hops: [
        { from: 'stub', to: 'resolver', label: 'www.example.com A?', kind: 'signal' },
        { from: 'resolver', to: 'resolver', label: 'キャッシュを引く', kind: 'signal' },
        { from: 'resolver', to: 'stub', label: 'A 203.0.113.80', kind: 'signal' },
      ],
      body:
        '1分後、別の端末が同じ名前を聞きました。リゾルバーはキャッシュから即座に答えます。ルートやTLDへの往復がない分、ずっと速く返ります。\n\nTTLは経過した分だけ減らして返します。3600 − 60 = 3540秒。0になったら捨てて、次はまた権威サーバーに聞き直します。',
      packet: {
        name: 'キャッシュからの応答',
        layers: ['IPv4', 'UDP', 'DNS'],
        fields: [
          { name: 'ID', hex: '5F 12', desc: '新しい問い合わせのID(例)' },
          { name: 'フラグ', hex: '81 80', bits: FLAG_BITS },
          ...counts('00 01', '00 01', '00 00', '00 00'),
          ...question(),
          { name: '回答:名前', hex: 'C0 0C' },
          { name: '回答:タイプ・クラス', hex: '00 01 00 01' },
          { name: '回答:TTL', hex: '00 00 0D D4', desc: '3540秒。キャッシュにいた60秒分だけ減っている' },
          { name: '回答:データ長', hex: '00 04' },
          { name: '回答:アドレス', hex: 'CB 00 71 50' },
        ],
      },
    },
    {
      id: 'nxdomain',
      title: '存在しない名前は NXDOMAIN',
      hops: [
        { from: 'stub', to: 'resolver', label: 'wwww.example.com A?', kind: 'signal' },
        { from: 'resolver', to: 'auth', label: 'wwww.example.com A?', kind: 'signal' },
        { from: 'auth', to: 'resolver', label: 'NXDOMAIN', kind: 'signal' },
        { from: 'resolver', to: 'stub', label: 'NXDOMAIN', kind: 'signal' },
      ],
      body:
        '打ち間違えた `wwww.example.com` を聞きました。`example.com` の権威サーバーはキャッシュ済みなので、リゾルバーはルートとTLDを飛ばして直接聞きます。\n\n答えは RCODE=3(**NXDOMAIN**、その名前は存在しない)。権威部にゾーンの SOA レコードが付き、「存在しない」こともしばらくキャッシュされます(ネガティブキャッシュ)。',
      packet: {
        name: 'NXDOMAIN の応答',
        layers: ['IPv4', 'UDP', 'DNS'],
        note: '権威部の SOA レコードは、先頭の名前・タイプ・クラス・TTLまでを示し、残りは省略しています。',
        fields: [
          { name: 'ID', hex: '6A 90', desc: '(例)' },
          { name: 'フラグ', hex: '81 83', desc: 'QR=1、RD=1、RA=1、RCODE=3(NXDOMAIN)', bits: FLAG_BITS },
          ...counts('00 01', '00 00', '00 01', '00 00'),
          ...question('wwww.example.com'),
          { name: '権威:SOA', hex: 'C0 11 00 06 00 01 00 00 0E 10 …', desc: 'ポインター → オフセット17の「example.com」、SOA、IN、TTL 3600' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 1034 Domain Names - Concepts and Facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034' },
    { label: 'RFC 1035 Domain Names - Implementation and Specification', url: 'https://www.rfc-editor.org/rfc/rfc1035' },
    { label: 'RFC 2308 Negative Caching of DNS Queries', url: 'https://www.rfc-editor.org/rfc/rfc2308' },
    { label: 'RFC 9499 DNS Terminology', url: 'https://www.rfc-editor.org/rfc/rfc9499' },
  ],
  lastVerified: '2026-11-06',
};

export default dns;
