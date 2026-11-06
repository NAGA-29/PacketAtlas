import type { CompareTable } from '../types';

const compareLink: CompareTable = {
  part: 1,
  title: 'つながるための4つの仕組みの比較',
  lead: 'どれも「パケットを相手に届ける」ための裏方ですが、**どの範囲で、何を住所にして働くか**が違います。',
  aspects: [
    { id: 'layer', label: '層' },
    { id: 'address', label: '使う住所' },
    { id: 'reach', label: '届く範囲' },
    { id: 'role', label: '役目' },
    { id: 'when', label: '動くとき' },
    { id: 'risk', label: '弱点' },
  ],
  columns: [
    {
      name: 'Ethernet と ARP',
      lessonId: 'ethernet-arp',
      cells: {
        layer: 'リンク層',
        address: 'MACアドレス(48bit)',
        reach: '同じネットワークの中だけ',
        role: '隣の機器まで1歩運ぶ。ARP はIPからMACを引く',
        when: 'パケットを送るたび。ARP はキャッシュが切れたとき',
        risk: 'ARP には認証がなく、偽の返事で横取りされうる',
      },
    },
    {
      name: 'IP',
      lessonId: 'ip',
      cells: {
        layer: 'インターネット層',
        address: 'IPアドレス(v4 は32bit、v6 は128bit)',
        reach: 'インターネット全体',
        role: 'ルーターを渡り継いで最終的な宛先まで運ぶ',
        when: 'すべての通信',
        risk: '届く保証はない。IPv4 は大きいと分割される',
      },
    },
    {
      name: 'ICMP',
      lessonId: 'icmp',
      cells: {
        layer: 'インターネット層(IPの上)',
        address: 'IPアドレス(ポートはない)',
        reach: 'インターネット全体',
        role: '届かなかった、TTLが尽きた、などを知らせる',
        when: 'エラーのときと、ping・traceroute',
        risk: '止めすぎると経路MTU探索などが壊れる',
      },
    },
    {
      name: 'DHCP',
      lessonId: 'dhcp',
      cells: {
        layer: 'アプリケーション層(UDP 67/68)',
        address: '最初は MAC と 0.0.0.0、ブロードキャスト',
        reach: '同じネットワーク(中継エージェントで越えられる)',
        role: 'IPアドレス、ゲートウェイ、DNS を配る',
        when: 'つないだときと、リースの更新',
        risk: '偽のDHCPサーバーが嘘の設定を配れる',
      },
    },
  ],
  lastVerified: '2026-11-06',
};

export default compareLink;
