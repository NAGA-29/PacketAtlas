import type { Lesson } from '../types';

const ethernetArp: Lesson = {
  id: 'ethernet-arp',
  part: 1,
  order: 1,
  title: 'Ethernet と ARP',
  tagline: 'IPアドレスからMACアドレスを引き、隣へ届ける',
  lead:
    '**同じネットワークの中で、隣の機器まで1歩運ぶのが Ethernet の仕事です。**宛先はIPアドレスではなく、機器ごとのMACアドレスで指定します。IPアドレスしか知らないときは、ARP で「このIPの持ち主は誰?」と全員に聞きます。',
  overview: {
    layer: 'リンク層(第2層)',
    transport: '—(物理的な回線の上)',
    ports: 'なし(MACアドレスで宛先を指定)',
    format: 'バイナリ(ヘッダー14バイト + FCS4バイト、ARP は28バイト)',
    key: { label: '主な EtherType', value: '0x0800 IPv4、0x0806 ARP、0x86DD IPv6' },
    specs: ['RFC 826', 'IEEE 802.3'],
  },
  lanes: [
    { id: 'pc', name: 'PC', sub: '192.0.2.10 / 00:00:5E:00:53:0A' },
    { id: 'switch', name: 'スイッチ', sub: 'L2' },
    { id: 'router', name: 'ルーター', sub: '192.0.2.1 / 00:00:5E:00:53:01' },
  ],
  steps: [
    {
      id: 'decide',
      title: 'どこへ渡すかを決める',
      hops: [{ from: 'pc', to: 'pc', label: '宛先を判定', kind: 'control' }],
      body:
        'PCは 203.0.113.7 にパケットを送りたいところです。自分のネットワーク(192.0.2.0/24)の外なので、直接は届けられません。まずデフォルトゲートウェイのルーター 192.0.2.1 に渡すと決めます。\n\nところが Ethernet で送るにはルーターのMACアドレスが必要で、それがまだ分かりません。',
      packet: {
        name: 'PCの判断',
        note: 'ネットワークには流れない、PCの中の処理です。',
        fields: [
          { name: '宛先', text: '203.0.113.7', lineBreak: true },
          { name: '自分のネットワーク', text: '192.0.2.10/24 → 192.0.2.0〜192.0.2.255', lineBreak: true, desc: '宛先は範囲の外' },
          { name: '次に渡す相手', text: 'デフォルトゲートウェイ 192.0.2.1', lineBreak: true },
          { name: 'ARPキャッシュ', text: '192.0.2.1 → (なし)', lineBreak: true, desc: 'MACアドレスを調べる必要がある' },
        ],
      },
    },
    {
      id: 'arp-request',
      title: 'ARPで全員に聞く',
      hops: [
        { from: 'pc', to: 'switch', label: 'ARP Request', kind: 'signal' },
        { from: 'switch', to: 'router', label: '全ポートへ', kind: 'signal' },
      ],
      body:
        '宛先MACを `FF:FF:FF:FF:FF:FF`(**ブロードキャスト**)にして「192.0.2.1 を持っている人は、MACアドレスを教えて」と送ります。スイッチは、これを受け取ったポート以外の全ポートに流します。\n\n問い合わせに自分のIPとMACも入れておくので、受け取った側は返事の宛先が分かります。',
      packet: {
        name: 'ARPリクエスト',
        layers: ['Ethernet', 'ARP'],
        note: 'Ethernet の最小長(60バイト)に足りない分は、末尾がゼロで埋められます。ここでは埋め草とFCSを省いています。',
        fields: [
          { name: '宛先MAC', hex: 'FF FF FF FF FF FF', desc: 'ブロードキャスト(全員あて)' },
          { name: '送信元MAC', hex: '00 00 5E 00 53 0A', desc: 'PC' },
          { name: 'タイプ', hex: '08 06', desc: '0x0806 = ARP' },
          { name: 'ハードウェア種別', hex: '00 01', desc: 'Ethernet' },
          { name: 'プロトコル種別', hex: '08 00', desc: 'IPv4' },
          { name: '長さ', hex: '06 04', desc: 'MACは6バイト、IPv4は4バイト' },
          { name: '操作', hex: '00 01', desc: '1 = Request' },
          { name: '送信者MAC', hex: '00 00 5E 00 53 0A' },
          { name: '送信者IP', hex: 'C0 00 02 0A', desc: '192.0.2.10' },
          { name: '目標MAC', hex: '00 00 00 00 00 00', desc: 'これを知りたい' },
          { name: '目標IP', hex: 'C0 00 02 01', desc: '192.0.2.1' },
        ],
      },
    },
    {
      id: 'learn',
      title: 'スイッチは送信元を覚える',
      hops: [{ from: 'switch', to: 'switch', label: 'MACを学習', kind: 'control' }],
      body:
        'スイッチは、届いたフレームの**送信元MAC**と、届いたポートの組を表に書き込みます。次に `00:00:5E:00:53:0A` 宛てのフレームが来たら、ポート1にだけ流せばよいと分かります。\n\n表にない宛先はとりあえず全ポートへ流し、返事が来た時点で覚えます。こうしてスイッチは設定なしで賢くなっていきます。',
      packet: {
        name: 'スイッチのMACアドレステーブル',
        note: 'ネットワークには流れない、スイッチの中の表です。',
        fields: [
          { name: 'ポート1', text: '00:00:5E:00:53:0A(PC)', lineBreak: true, desc: '今のARPリクエストで覚えた' },
          { name: 'ポート8', text: '(まだ不明)', lineBreak: true, desc: 'ルーターが返事をしたら埋まる' },
        ],
      },
    },
    {
      id: 'arp-reply',
      title: 'ルーターが自分だと答える',
      hops: [
        { from: 'router', to: 'switch', label: 'ARP Reply', kind: 'signal' },
        { from: 'switch', to: 'pc', label: 'ポート1へ', kind: 'signal' },
      ],
      body:
        '192.0.2.1 を持つルーターだけが返事をします。今度は宛先がPCのMACなので**ユニキャスト**です。スイッチはさっき覚えた表を見て、ポート1にだけ流します。\n\nPCは結果をARPキャッシュに入れます。しばらくのあいだ、同じ問い合わせはしません。',
      packet: {
        name: 'ARPリプライ',
        layers: ['Ethernet', 'ARP'],
        fields: [
          { name: '宛先MAC', hex: '00 00 5E 00 53 0A', desc: 'PCだけに返す' },
          { name: '送信元MAC', hex: '00 00 5E 00 53 01', desc: 'ルーター' },
          { name: 'タイプ', hex: '08 06', desc: 'ARP' },
          { name: 'ハードウェア種別', hex: '00 01' },
          { name: 'プロトコル種別', hex: '08 00' },
          { name: '長さ', hex: '06 04' },
          { name: '操作', hex: '00 02', desc: '2 = Reply' },
          { name: '送信者MAC', hex: '00 00 5E 00 53 01', desc: 'これが答え' },
          { name: '送信者IP', hex: 'C0 00 02 01', desc: '192.0.2.1' },
          { name: '目標MAC', hex: '00 00 5E 00 53 0A' },
          { name: '目標IP', hex: 'C0 00 02 0A' },
        ],
      },
    },
    {
      id: 'frame',
      title: 'IPパケットをフレームに入れて渡す',
      hops: [
        { from: 'pc', to: 'switch', label: 'Ethernet + IPv4', kind: 'data' },
        { from: 'switch', to: 'router', label: 'ポート8へ', kind: 'data' },
      ],
      body:
        'ようやく本題のパケットを送れます。IPの宛先は 203.0.113.7 のままで、Ethernet の宛先だけがルーターのMACです。**IPは最終目的地、MACは次の1歩**という役割分担です。\n\n短いパケットは60バイトまでゼロで埋め、最後に4バイトの **FCS**(CRC-32)を付けます。受け取った側は計算し直して、壊れていれば捨てます。',
      packet: {
        name: 'Ethernetフレーム(UDP章の「ping」)',
        layers: ['Ethernet', 'IPv4', 'UDP'],
        fields: [
          { name: '宛先MAC', hex: '00 00 5E 00 53 01', desc: 'ルーター' },
          { name: '送信元MAC', hex: '00 00 5E 00 53 0A', desc: 'PC' },
          { name: 'タイプ', hex: '08 00', desc: '0x0800 = IPv4' },
          { name: 'IPv4ヘッダー', hex: '45 00 00 20 1C 46 40 00 40 11 20 75 C0 00 02 0A CB 00 71 07', desc: '宛先は 203.0.113.7 のまま' },
          { name: 'UDP + データ', hex: 'C3 50 23 28 00 0C 3C 7A 70 69 6E 67', desc: '「ping」' },
          { name: '埋め草', hex: '00 00 00 00 00 00 00 00 00 00 00 00 00 00', desc: '最小の60バイトまで14バイト足りない' },
          { name: 'FCS', hex: 'A6 7A 16 41', desc: 'ここまで60バイトの CRC-32(下位バイトから送る)' },
        ],
      },
    },
    {
      id: 'cache',
      title: '2回目からはARPなし',
      hops: [
        { from: 'pc', to: 'pc', label: 'ARPキャッシュを引く', kind: 'control' },
        { from: 'pc', to: 'switch', label: 'Ethernet + IPv4', kind: 'data' },
        { from: 'switch', to: 'router', label: 'ポート8へ', kind: 'data' },
      ],
      body:
        '次のパケットからは、キャッシュにあるMACをすぐ使います。スイッチもルーターの場所を覚えたので、最初から1つのポートにだけ流します。\n\nARPには相手を確かめる仕組みがありません。同じネットワークの誰かが偽の返事を送ると、通信を横取りできてしまいます(**ARPスプーフィング**)。そのためスイッチ側で検査する機能があります。',
      packet: {
        name: 'PCのARPキャッシュ',
        note: 'ネットワークには流れない、PCの中の表です。',
        fields: [
          { name: '192.0.2.1', text: '00:00:5E:00:53:01', lineBreak: true, desc: '一定時間で消え、また問い合わせる' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 826 An Ethernet Address Resolution Protocol', url: 'https://www.rfc-editor.org/rfc/rfc826' },
    { label: 'RFC 894 IP over Ethernet', url: 'https://www.rfc-editor.org/rfc/rfc894' },
    { label: 'RFC 7042 IANA Considerations for IEEE 802(文書用のMACアドレス)', url: 'https://www.rfc-editor.org/rfc/rfc7042' },
    { label: 'IEEE 802.3 Ethernet', url: 'https://standards.ieee.org/ieee/802.3/' },
  ],
  lastVerified: '2026-11-06',
};

export default ethernetArp;
