import type { BitField, Field, Lesson } from '../types';

const VER_IHL: BitField[] = [
  { name: 'Version', bits: 4 },
  { name: 'IHL', bits: 4, desc: '32bit単位のヘッダー長' },
];
const FLAGS: BitField[] = [
  { name: '予約', bits: 1 },
  { name: 'DF', bits: 1, desc: '分割禁止' },
  { name: 'MF', bits: 1, desc: '続きの断片あり' },
  { name: 'Fragment Offset', bits: 13, desc: '8バイト単位の位置' },
];

const v4 = (o: { len: string; lenDesc: string; id: string; flags: string; flagsDesc: string; ttl: string; ttlDesc: string; proto: string; protoDesc: string; sum: string; sumDesc?: string }): Field[] => [
  { name: 'バージョン + ヘッダー長', hex: '45', desc: 'IPv4、20バイト', bits: VER_IHL },
  { name: 'サービス種別', hex: '00', desc: 'DSCP(優先度)と ECN(混雑の通知)' },
  { name: '全長', hex: o.len, desc: o.lenDesc },
  { name: '識別子', hex: o.id, desc: '断片をまとめ直すための番号(例)' },
  { name: 'フラグ + 断片位置', hex: o.flags, desc: o.flagsDesc, bits: FLAGS },
  { name: 'TTL', hex: o.ttl, desc: o.ttlDesc },
  { name: 'プロトコル', hex: o.proto, desc: o.protoDesc },
  { name: 'ヘッダーチェックサム', hex: o.sum, desc: o.sumDesc ?? 'IPヘッダーだけの検査値' },
  { name: '送信元アドレス', hex: 'C0 00 02 0A', desc: '192.0.2.10' },
  { name: '宛先アドレス', hex: 'CB 00 71 50', desc: '203.0.113.80' },
];

const ip: Lesson = {
  id: 'ip',
  part: 1,
  order: 2,
  title: 'IP(v4 / v6)',
  tagline: 'TTLを減らしながらルーターを渡っていく',
  lead:
    '**ネットワークをまたいで、最終的な宛先までパケットを運ぶプロトコル。**ルーターは宛先アドレスを見て次のルーターへ渡すことを繰り返します。届く保証はしません。IPv4 の住所は32bitで足りなくなり、128bitの IPv6 へ移りつつあります。',
  lanes: [
    { id: 'pc', name: 'PC', sub: '192.0.2.10' },
    { id: 'r1', name: 'ルーター1', sub: '192.0.2.1' },
    { id: 'r2', name: 'ルーター2', sub: '198.51.100.1' },
    { id: 'server', name: 'サーバー', sub: '203.0.113.80' },
  ],
  steps: [
    {
      id: 'header',
      title: 'IPv4ヘッダーを付けて送り出す',
      hops: [{ from: 'pc', to: 'r1', label: 'TTL=64', kind: 'data' }],
      body:
        'TCP章のSYN(32バイト)の前に、20バイトのIPv4ヘッダーが付きます。大事なのは**宛先アドレス**と **TTL**、それに中身の種類を示す**プロトコル**番号です。\n\nTTLは「あと何回ルーターを越えてよいか」。経路がループしても、パケットが永遠に回り続けないための仕組みです。',
      packet: {
        name: 'IPv4ヘッダー(PCが送った時点)',
        layers: ['Ethernet', 'IPv4', 'TCP'],
        fields: v4({ len: '00 34', lenDesc: '20 + TCP 32 = 52バイト', id: '5A 3E', flags: '40 00', flagsDesc: 'DF=1', ttl: '40', ttlDesc: '64', proto: '06', protoDesc: '6 = TCP', sum: 'E2 2A' }),
      },
    },
    {
      id: 'ttl',
      title: 'ルーターはTTLを1減らす',
      hops: [{ from: 'r1', to: 'r2', label: 'TTL=63', kind: 'data' }],
      body:
        'ルーター1は宛先を見て、ルーター2へ渡すと決めます。渡す前に TTL を 64 → 63 に減らし、ヘッダーが変わったのでチェックサムも計算し直します。\n\nEthernet のヘッダーは毎回付け替えられますが、IPの送信元と宛先は最後まで変わりません(NATがなければ)。',
      packet: {
        name: 'IPv4ヘッダー(ルーター1を出た後)',
        layers: ['Ethernet', 'IPv4', 'TCP'],
        fields: v4({ len: '00 34', lenDesc: '52バイト', id: '5A 3E', flags: '40 00', flagsDesc: 'DF=1', ttl: '3F', ttlDesc: '63。1つ減った', proto: '06', protoDesc: 'TCP', sum: 'E3 2A', sumDesc: 'TTLが変わったので計算し直した' }),
      },
    },
    {
      id: 'routing',
      title: '一番細かく当てはまる経路を選ぶ',
      hops: [{ from: 'r2', to: 'r2', label: 'ルーティング表', kind: 'control' }],
      body:
        'ルーター2の経路表には、宛先の範囲と次の行き先が並んでいます。203.0.113.80 には複数の行が当てはまりますが、**一番長いプレフィックス**(/26)の行が選ばれます(最長一致)。\n\nどの行にも当たらないときは、`0.0.0.0/0`(デフォルト経路)を使います。',
      packet: {
        name: 'ルーター2の経路表',
        note: 'ネットワークには流れない、ルーターの中の表です。',
        fields: [
          { name: '0.0.0.0/0', text: '→ 上流 198.51.100.254', lineBreak: true, desc: '当てはまるが /0 は一番短い' },
          { name: '203.0.113.0/24', text: '→ ルーター 198.51.100.9', lineBreak: true, desc: '当てはまる(/24)' },
          { name: '203.0.113.64/26', text: '→ 直結 インターフェース eth2', lineBreak: true, desc: '.64〜.127。一番長い /26 なので選ばれる' },
        ],
      },
    },
    {
      id: 'fragment',
      title: '大きすぎると分割される(IPv4)',
      hops: [
        { from: 'r2', to: 'server', label: '断片1 MF=1', kind: 'data' },
        { from: 'r2', to: 'server', label: '断片2 offset=172', kind: 'data' },
      ],
      body:
        '2028バイトのUDPパケット(DF=0)が来ましたが、次の回線は1400バイトまでしか通せません(**MTU**)。ルーター2はデータ部分を1376バイトと632バイトに分け、それぞれにIPヘッダーを付けて送ります。\n\n断片位置は8バイト単位で、2つ目は 1376 ÷ 8 = 172。宛先のサーバーが同じ識別子の断片を集めて元に戻します。1つでも落ちると全体が失われるので、今はなるべく分割を避けます。',
      packet: {
        name: 'IPv4ヘッダー(断片2)',
        layers: ['IPv4'],
        fields: v4({ len: '02 8C', lenDesc: '20 + 632 = 652バイト', id: '2B 10', flags: '00 AC', flagsDesc: 'MF=0(最後の断片)、位置 172 × 8 = 1376バイト目から', ttl: '3E', ttlDesc: '62', proto: '11', protoDesc: 'UDP(UDPヘッダーは断片1にだけある)', sum: '50 4A' }),
      },
    },
    {
      id: 'pmtud',
      title: '分割禁止なら「小さくして」と返す',
      hops: [
        { from: 'pc', to: 'r1', label: 'DF=1 1500B', kind: 'data' },
        { from: 'r1', to: 'r2', label: 'DF=1 1500B', kind: 'data' },
        { from: 'r2', to: 'pc', label: 'ICMP 要分割 MTU=1400', kind: 'control' },
      ],
      body:
        'DF=1(分割禁止)の1500バイトのパケットは、ルーター2で通せません。ルーター2は捨てて、ICMP で「分割が必要、次の回線のMTUは1400」と送信元に知らせます。\n\nPCはこれを見て、以後は小さく送ります(**経路MTU探索**)。ICMP をファイアウォールで全部止めると、この知らせが届かず通信が固まることがあります。',
      packet: {
        name: 'ICMP Fragmentation Needed',
        layers: ['IPv4', 'ICMP'],
        fields: [
          { name: 'タイプ', hex: '03', desc: '宛先到達不能' },
          { name: 'コード', hex: '04', desc: '分割が必要だが DF が立っている' },
          { name: 'チェックサム', hex: 'FB B8' },
          { name: '未使用', hex: '00 00' },
          { name: '次のMTU', hex: '05 78', desc: '1400バイト' },
          { name: '元のIPヘッダー', hex: '45 00 05 DC 2B 11 40 00 3F 11 0C A5 C0 00 02 0A CB 00 71 50', desc: '全長1500、DF=1、ルーター2に届いた時点で TTL 63' },
          { name: '元のUDPヘッダー', hex: 'C3 51 23 28 05 C8 0F 89', desc: '50001 → 9000、長さ1480' },
        ],
      },
    },
    {
      id: 'ipv6',
      title: 'IPv6:40バイト固定の簡素なヘッダー',
      hops: [{ from: 'pc', to: 'r1', label: 'IPv6 Hop Limit=64', kind: 'data' }],
      body:
        'IPv6 のアドレスは128bitで、事実上使い切れない数があります。ヘッダーは40バイト固定で、チェックサムはありません(下の層と上の層が検査するので省いた)。\n\nルーターは分割をしません。大きすぎれば ICMPv6 で知らせ、分割が必要なら送信元が自分で行います。TTL は **Hop Limit** と名前が変わりました。',
      packet: {
        name: 'IPv6ヘッダー',
        layers: ['Ethernet', 'IPv6', 'TCP'],
        fields: [
          {
            name: 'バージョン・クラス・フローラベル',
            hex: '60 00 00 00',
            desc: 'バージョン6。優先度とフローの識別は使っていない',
            bits: [
              { name: 'Version', bits: 4, desc: '6' },
              { name: 'Traffic Class', bits: 8 },
              { name: 'Flow Label', bits: 20 },
            ],
          },
          { name: 'ペイロード長', hex: '00 20', desc: '32バイト(ヘッダーを含まない)' },
          { name: '次ヘッダー', hex: '06', desc: 'TCP。IPv4のプロトコル番号にあたる' },
          { name: 'Hop Limit', hex: '40', desc: '64' },
          { name: '送信元アドレス', hex: '20 01 0D B8 00 00 00 00 00 00 00 00 00 00 00 0A', desc: '2001:db8::a' },
          { name: '宛先アドレス', hex: '20 01 0D B8 00 01 00 00 00 00 00 00 00 00 00 50', desc: '2001:db8:1::50' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 791 Internet Protocol', url: 'https://www.rfc-editor.org/rfc/rfc791' },
    { label: 'RFC 8200 IPv6 Specification', url: 'https://www.rfc-editor.org/rfc/rfc8200' },
    { label: 'RFC 1191 Path MTU Discovery', url: 'https://www.rfc-editor.org/rfc/rfc1191' },
    { label: 'RFC 4632 CIDR', url: 'https://www.rfc-editor.org/rfc/rfc4632' },
    { label: 'RFC 3849 IPv6 Address Prefix Reserved for Documentation', url: 'https://www.rfc-editor.org/rfc/rfc3849' },
  ],
  lastVerified: '2026-11-06',
};

export default ip;
