import type { Field, Lesson } from '../types';

/** 固定部(先頭44バイト)を欄ごとに。sname / file は省略 */
const fixed = (o: { op: string; opDesc: string; xid: string; flags: string; flagsDesc: string; ciaddr: string; ciaddrDesc: string; yiaddr: string; yiaddrDesc: string }): Field[] => [
  { name: 'op', hex: o.op, desc: o.opDesc },
  { name: 'htype / hlen / hops', hex: '01 06 00', desc: 'Ethernet、MAC長6、中継0回' },
  { name: 'xid', hex: o.xid, desc: 'やり取りの番号(例)。応答に同じ値が入る' },
  { name: 'secs', hex: '00 00', desc: '取得を始めてからの秒数' },
  {
    name: 'flags',
    hex: o.flags,
    desc: o.flagsDesc,
    bits: [
      { name: 'B', bits: 1, desc: 'ブロードキャストで返して' },
      { name: '予約', bits: 15 },
    ],
  },
  { name: 'ciaddr', hex: o.ciaddr, desc: o.ciaddrDesc },
  { name: 'yiaddr', hex: o.yiaddr, desc: o.yiaddrDesc },
  { name: 'siaddr / giaddr', hex: '00 00 00 00 00 00 00 00', desc: '次のサーバーと中継エージェント(使わない)' },
  { name: 'chaddr', hex: '00 00 5E 00 53 0A 00 00 00 00 00 00 00 00 00 00', desc: 'クライアントのMAC。16バイト欄の先頭6バイト' },
  { name: 'sname / file', hex: '…', desc: '192バイトのゼロ(BOOTP時代の名残)' },
  { name: 'マジッククッキー', hex: '63 82 53 63', desc: 'ここからDHCPのオプション' },
];

const SERVER_OPTIONS: Field[] = [
  { name: 'サーバーID', hex: '36 04 C0 00 02 01', desc: 'オプション54:192.0.2.1' },
  { name: 'リース時間', hex: '33 04 00 01 51 80', desc: 'オプション51:86400秒 = 1日' },
  { name: 'サブネットマスク', hex: '01 04 FF FF FF 00', desc: 'オプション1:255.255.255.0' },
  { name: 'ルーター', hex: '03 04 C0 00 02 01', desc: 'オプション3:デフォルトゲートウェイ 192.0.2.1' },
  { name: 'DNSサーバー', hex: '06 04 C6 33 64 35', desc: 'オプション6:198.51.100.53' },
  { name: '終わり', hex: 'FF' },
];

const dhcp: Lesson = {
  id: 'dhcp',
  part: 1,
  order: 4,
  title: 'DHCP',
  tagline: 'つないだ瞬間にアドレスをもらう4手順',
  lead:
    '**ネットワークにつないだ端末に、IPアドレスや DNS サーバーの場所を配る仕組み。**まだ自分のアドレスがない状態から始まるので、最初はブロードキャストで呼びかけます。Discover・Offer・Request・Ack の頭文字から **DORA** と呼ばれます。',
  lanes: [
    { id: 'client', name: 'クライアント', sub: '0.0.0.0 / 00:00:5E:00:53:0A' },
    { id: 'server', name: 'DHCPサーバー', sub: '192.0.2.1' },
  ],
  steps: [
    {
      id: 'discover',
      title: 'Discover:誰かアドレスをください',
      hops: [{ from: 'client', to: 'server', label: 'DHCPDISCOVER', kind: 'signal' }],
      body:
        '端末はまだIPアドレスを持っていないので、送信元 0.0.0.0、宛先 255.255.255.255 のブロードキャストで呼びかけます。UDPのポートはクライアントが68、サーバーが67です。\n\n「サブネットマスク・ルーター・DNSサーバーを教えてほしい」という希望も一緒に送ります。',
      packet: {
        name: 'DHCPDISCOVER',
        layers: ['Ethernet', 'IPv4', 'UDP', 'DHCP'],
        fields: [
          ...fixed({ op: '01', opDesc: '1 = クライアントからの要求', xid: '39 03 F3 26', flags: '80 00', flagsDesc: 'まだアドレスがないので、返事もブロードキャストで', ciaddr: '00 00 00 00', ciaddrDesc: '自分のアドレス(まだない)', yiaddr: '00 00 00 00', yiaddrDesc: '配られるアドレス(まだない)' }),
          { name: 'メッセージ種別', hex: '35 01 01', desc: 'オプション53:1 = DISCOVER' },
          { name: '欲しい項目', hex: '37 03 01 03 06', desc: 'オプション55:マスク、ルーター、DNS' },
          { name: '終わり', hex: 'FF' },
        ],
      },
    },
    {
      id: 'offer',
      title: 'Offer:このアドレスはどう?',
      hops: [{ from: 'server', to: 'client', label: 'DHCPOFFER', kind: 'signal' }],
      body:
        'サーバーは空いているアドレスから 192.0.2.10 を選び、**yiaddr** に入れて提案します。リース時間やゲートウェイ、DNSサーバーも添えます。\n\nサーバーが複数あれば、複数の Offer が届くこともあります。この時点ではまだ確定していません。',
      packet: {
        name: 'DHCPOFFER',
        layers: ['Ethernet', 'IPv4', 'UDP', 'DHCP'],
        fields: [
          ...fixed({ op: '02', opDesc: '2 = サーバーからの応答', xid: '39 03 F3 26', flags: '80 00', flagsDesc: 'ブロードキャストで返す', ciaddr: '00 00 00 00', ciaddrDesc: '', yiaddr: 'C0 00 02 0A', yiaddrDesc: '192.0.2.10 を提案' }),
          { name: 'メッセージ種別', hex: '35 01 02', desc: '2 = OFFER' },
          ...SERVER_OPTIONS,
        ],
      },
    },
    {
      id: 'request',
      title: 'Request:それにします',
      hops: [{ from: 'client', to: 'server', label: 'DHCPREQUEST', kind: 'signal' }],
      body:
        'クライアントは1つの Offer を選び、もう一度ブロードキャストで「192.0.2.1 の提案した 192.0.2.10 にします」と送ります。ブロードキャストなので、選ばれなかったサーバーも知ることができ、確保していたアドレスを戻せます。\n\nどのサーバーを選んだかは、サーバーIDのオプションで示します。',
      packet: {
        name: 'DHCPREQUEST',
        layers: ['Ethernet', 'IPv4', 'UDP', 'DHCP'],
        note: '固定部は Discover と同じなので省略し、オプション部分だけを示します。',
        fields: [
          { name: 'マジッククッキー', hex: '63 82 53 63' },
          { name: 'メッセージ種別', hex: '35 01 03', desc: '3 = REQUEST' },
          { name: '希望するアドレス', hex: '32 04 C0 00 02 0A', desc: 'オプション50:192.0.2.10' },
          { name: 'サーバーID', hex: '36 04 C0 00 02 01', desc: '選んだのは 192.0.2.1' },
          { name: '欲しい項目', hex: '37 03 01 03 06' },
          { name: '終わり', hex: 'FF' },
        ],
      },
    },
    {
      id: 'ack',
      title: 'Ack:確定',
      hops: [{ from: 'server', to: 'client', label: 'DHCPACK', kind: 'signal' }],
      body:
        'サーバーが Ack を返し、貸し出しが確定します。クライアントはアドレス、マスク、ゲートウェイ、DNSサーバーを設定し、ここから普通に通信できるようになります。\n\nアドレスは「もらう」のではなく**リース**(期限付きの貸し出し)です。期限内に延長しなければ返したことになります。',
      packet: {
        name: 'DHCPACK',
        layers: ['Ethernet', 'IPv4', 'UDP', 'DHCP'],
        note: '固定部は Offer と同じなので省略し、オプション部分だけを示します。',
        fields: [{ name: 'マジッククッキー', hex: '63 82 53 63' }, { name: 'メッセージ種別', hex: '35 01 05', desc: '5 = ACK' }, ...SERVER_OPTIONS],
      },
    },
    {
      id: 'probe',
      title: '使う前に重複を確かめる',
      hops: [{ from: 'client', to: 'server', label: 'ARP 192.0.2.10?', kind: 'signal' }],
      body:
        '念のため、クライアントは ARP で「192.0.2.10 を使っている人はいる?」と聞きます。誰かが答えたら、そのアドレスは使わず DHCPDECLINE で断ります。\n\n手で同じアドレスを設定した機器がいると、こうした衝突が起きます。',
      packet: {
        name: 'ARPプローブ(要点)',
        layers: ['Ethernet', 'ARP'],
        note: '形は Ethernet と ARP の章の ARP リクエストと同じです。送信者IPを 0.0.0.0 にするのがプローブの特徴です。',
        fields: [
          { name: '操作', hex: '00 01', desc: 'Request' },
          { name: '送信者MAC', hex: '00 00 5E 00 53 0A' },
          { name: '送信者IP', hex: '00 00 00 00', desc: 'まだ使い始めていないので 0.0.0.0' },
          { name: '目標MAC', hex: '00 00 00 00 00 00' },
          { name: '目標IP', hex: 'C0 00 02 0A', desc: '192.0.2.10 の持ち主を探す' },
        ],
      },
    },
    {
      id: 'renew',
      title: '期限の半分で延長する',
      hops: [
        { from: 'client', to: 'server', label: 'DHCPREQUEST(更新)', kind: 'signal' },
        { from: 'server', to: 'client', label: 'DHCPACK', kind: 'signal' },
      ],
      body:
        'リース時間の半分(**T1**、ここでは12時間)が過ぎると、クライアントは延長を頼みます。今度は自分のアドレスがあるので、サーバーに直接ユニキャストで送り、ciaddr に今のアドレスを入れます。\n\n返事がなければ 7/8 の時点(**T2**)で他のサーバーにも呼びかけ、期限が切れたら最初からやり直します。',
      packet: {
        name: 'DHCPREQUEST(更新)',
        layers: ['Ethernet', 'IPv4', 'UDP', 'DHCP'],
        fields: [
          ...fixed({ op: '01', opDesc: '要求', xid: '7A 11 C0 DE', flags: '00 00', flagsDesc: 'ユニキャストで返してよい', ciaddr: 'C0 00 02 0A', ciaddrDesc: '今使っている 192.0.2.10', yiaddr: '00 00 00 00', yiaddrDesc: '' }),
          { name: 'メッセージ種別', hex: '35 01 03', desc: 'REQUEST' },
          { name: '終わり', hex: 'FF' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 2131 Dynamic Host Configuration Protocol', url: 'https://www.rfc-editor.org/rfc/rfc2131' },
    { label: 'RFC 2132 DHCP Options and BOOTP Vendor Extensions', url: 'https://www.rfc-editor.org/rfc/rfc2132' },
    { label: 'RFC 5227 IPv4 Address Conflict Detection', url: 'https://www.rfc-editor.org/rfc/rfc5227' },
  ],
  lastVerified: '2026-11-06',
};

export default dhcp;
