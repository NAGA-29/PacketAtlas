import type { Lesson } from '../types';

const icmp: Lesson = {
  id: 'icmp',
  part: 1,
  order: 3,
  title: 'ICMP',
  tagline: 'ping と traceroute の正体',
  lead:
    '**IPの調子を知らせ合うための、小さな連絡用プロトコル。**「届かなかった」「TTLが尽きた」といった知らせをルーターや宛先が返します。ping と traceroute は、この仕組みを確かめに使う道具です。',
  lanes: [
    { id: 'pc', name: 'PC', sub: '192.0.2.10' },
    { id: 'r1', name: 'ルーター1', sub: '192.0.2.1' },
    { id: 'r2', name: 'ルーター2', sub: '198.51.100.1' },
    { id: 'server', name: 'サーバー', sub: '203.0.113.80' },
  ],
  steps: [
    {
      id: 'echo-request',
      title: 'ping:Echo Request を送る',
      hops: [
        { from: 'pc', to: 'r1', label: 'Echo Request', kind: 'control' },
        { from: 'r1', to: 'r2', label: 'Echo Request', kind: 'control' },
        { from: 'r2', to: 'server', label: 'Echo Request', kind: 'control' },
      ],
      body:
        '`ping 203.0.113.80` は、ICMP の Echo Request を送ります。識別子とシーケンス番号を付け、送った時刻を覚えておきます。\n\nICMP は TCP や UDP と並ぶ、IPの直接の中身です。ポート番号はありません。',
      packet: {
        name: 'ICMP Echo Request',
        layers: ['IPv4', 'ICMP'],
        fields: [
          { name: 'タイプ', hex: '08', desc: '8 = Echo Request' },
          { name: 'コード', hex: '00' },
          { name: 'チェックサム', hex: '70 9C', desc: 'ICMPメッセージ全体の検査値' },
          { name: '識別子', hex: '4D 2A', desc: 'どの ping の分かを見分ける(例)' },
          { name: 'シーケンス', hex: '00 01', desc: '1回ごとに増える' },
          { name: 'データ', hex: '50 61 63 6B 65 74 41 74 6C 61 73 21', desc: '「PacketAtlas!」。そのまま返ってくる' },
        ],
      },
    },
    {
      id: 'echo-reply',
      title: 'Echo Reply が返り、往復時間が分かる',
      hops: [
        { from: 'server', to: 'r2', label: 'Echo Reply', kind: 'control' },
        { from: 'r2', to: 'r1', label: 'Echo Reply', kind: 'control' },
        { from: 'r1', to: 'pc', label: 'Echo Reply', kind: 'control' },
      ],
      body:
        'サーバーはタイプを 0 に変え、識別子・シーケンス・データをそのまま返します。PCは送った時刻との差で**往復時間(RTT)**を表示します。\n\nタイプが 8 から 0 に変わっただけなので、チェックサムも 0x0800 だけずれています。返事がないときは、途中で ICMP が止められている可能性もあり、相手が落ちているとは限りません。',
      packet: {
        name: 'ICMP Echo Reply',
        layers: ['IPv4', 'ICMP'],
        fields: [
          { name: 'タイプ', hex: '00', desc: '0 = Echo Reply' },
          { name: 'コード', hex: '00' },
          { name: 'チェックサム', hex: '78 9C' },
          { name: '識別子', hex: '4D 2A', desc: '同じ値' },
          { name: 'シーケンス', hex: '00 01' },
          { name: 'データ', hex: '50 61 63 6B 65 74 41 74 6C 61 73 21' },
        ],
      },
    },
    {
      id: 'ttl-1',
      title: 'traceroute:TTL=1 で送る',
      hops: [
        { from: 'pc', to: 'r1', label: 'UDP TTL=1', kind: 'data' },
        { from: 'r1', to: 'pc', label: 'Time Exceeded', kind: 'control' },
      ],
      body:
        'traceroute は、わざと TTL=1 のパケットを送ります。ルーター1は TTL を減らすと0になるので捨て、**Time Exceeded** を返します。その送信元アドレスが「1つ目のルーター」です。\n\n返事には、捨てたパケットのIPヘッダーと先頭8バイトが入っています。宛先ポート 33434 を見て、どのプローブへの返事かを見分けます。',
      packet: {
        name: 'ICMP Time Exceeded',
        layers: ['IPv4', 'ICMP'],
        fields: [
          { name: 'タイプ', hex: '0B', desc: '11 = Time Exceeded' },
          { name: 'コード', hex: '00', desc: '0 = 転送中に TTL が尽きた' },
          { name: 'チェックサム', hex: 'F3 74' },
          { name: '未使用', hex: '00 00 00 00' },
          { name: '元のIPヘッダー', hex: '45 00 00 1C 7E 01 00 00 01 11 3D 75 C0 00 02 0A CB 00 71 50', desc: 'TTL=1、UDP、203.0.113.80 宛て' },
          { name: '元のUDPヘッダー', hex: 'C3 51 82 9A 00 08 BB 96', desc: '50001 → 33434' },
        ],
      },
    },
    {
      id: 'ttl-2',
      title: 'TTLを1つずつ増やして道をたどる',
      hops: [
        { from: 'pc', to: 'r1', label: 'UDP TTL=2', kind: 'data' },
        { from: 'r1', to: 'r2', label: 'TTL=1', kind: 'data' },
        { from: 'r2', to: 'r1', label: 'Time Exceeded', kind: 'control' },
        { from: 'r1', to: 'pc', label: 'Time Exceeded', kind: 'control' },
      ],
      body:
        '次は TTL=2 で送り、ルーター2から Time Exceeded をもらいます。TTL を増やしながら繰り返すと、経路上のルーターが順に分かります。\n\n各段で3回ずつ送るのが普通で、RTTのばらつきも見えます。`*` は返事が来なかった印で、そのルーターが ICMP を返さない設定なだけのこともあります。',
      packet: {
        name: 'traceroute の表示',
        note: 'ネットワークには流れない、PCの画面の表示です。時間は例です。',
        fields: [
          { name: '1', text: '192.0.2.1     1.2 ms  1.1 ms  1.3 ms', lineBreak: true },
          { name: '2', text: '198.51.100.1  8.5 ms  8.7 ms  *', lineBreak: true, desc: '3回目は返事がなかった' },
          { name: '3', text: '203.0.113.80  9.9 ms  9.8 ms  10.1 ms', lineBreak: true, desc: '次の手順で分かる' },
        ],
      },
    },
    {
      id: 'arrive',
      title: '宛先に届くとポート到達不能が返る',
      hops: [
        { from: 'pc', to: 'r1', label: 'UDP TTL=3 :33436', kind: 'data' },
        { from: 'r1', to: 'r2', label: 'TTL=2', kind: 'data' },
        { from: 'r2', to: 'server', label: 'TTL=1', kind: 'data' },
        { from: 'server', to: 'pc', label: 'Port Unreachable', kind: 'control' },
      ],
      body:
        'TTL=3 のパケットはサーバーまで届きます。traceroute は使われていないはずの大きなポート番号を狙うので、サーバーは ICMP の**ポート到達不能**(タイプ3、コード3)を返します。\n\nTime Exceeded ではなくこれが返ってきたら、宛先に着いたという合図です。traceroute はここで終わります。',
      packet: {
        name: 'ICMP Port Unreachable(先頭)',
        layers: ['IPv4', 'ICMP'],
        note: '中身の形は UDP 章の手順7と同じなので、先頭の8バイトだけを示します。',
        fields: [
          { name: 'タイプ', hex: '03', desc: '宛先到達不能' },
          { name: 'コード', hex: '03', desc: 'ポート到達不能' },
          { name: 'チェックサム', hex: '…', desc: '(省略)' },
          { name: '未使用', hex: '00 00 00 00' },
          { name: '元のIPヘッダーとUDPヘッダー', hex: '…', desc: '宛先ポート 33436 のプローブ' },
        ],
      },
    },
    {
      id: 'icmpv6',
      title: 'IPv6 では ICMPv6 が欠かせない',
      hops: [
        { from: 'pc', to: 'r1', label: 'ICMPv6 Echo', kind: 'control' },
        { from: 'r1', to: 'r2', label: 'ICMPv6 Echo', kind: 'control' },
        { from: 'r2', to: 'server', label: 'ICMPv6 Echo', kind: 'control' },
      ],
      body:
        'IPv6 の ping は ICMPv6 で、Echo Request のタイプは 128 です。ICMPv6 は ARP の代わりの**近隣探索**や、経路MTUの通知も受け持つので、IPv4 以上に止めてはいけません。\n\nIPv6 ヘッダーにはチェックサムがないので、ICMPv6 は送信元・宛先アドレスを含む疑似ヘッダーごと検査します。',
      packet: {
        name: 'ICMPv6 Echo Request',
        layers: ['IPv6', 'ICMPv6'],
        fields: [
          { name: 'タイプ', hex: '80', desc: '128 = Echo Request' },
          { name: 'コード', hex: '00' },
          { name: 'チェックサム', hex: '9C 80', desc: '2001:db8::a → 2001:db8:1::50 の疑似ヘッダー込み' },
          { name: '識別子', hex: '4D 2A' },
          { name: 'シーケンス', hex: '00 01' },
          { name: 'データ', hex: '50 61 63 6B 65 74 41 74 6C 61 73 21', desc: '「PacketAtlas!」' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 792 Internet Control Message Protocol', url: 'https://www.rfc-editor.org/rfc/rfc792' },
    { label: 'RFC 4443 ICMPv6', url: 'https://www.rfc-editor.org/rfc/rfc4443' },
    { label: 'RFC 4861 Neighbor Discovery for IPv6', url: 'https://www.rfc-editor.org/rfc/rfc4861' },
    { label: 'RFC 4890 ICMPv6 をファイアウォールで扱うときの推奨', url: 'https://www.rfc-editor.org/rfc/rfc4890' },
  ],
  lastVerified: '2026-11-06',
};

export default icmp;
