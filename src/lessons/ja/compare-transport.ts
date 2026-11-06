import type { CompareTable } from '../types';

const compareTransport: CompareTable = {
  part: 2,
  title: 'UDP と TCP の比較',
  lead: 'どちらもIPの上でポート番号を使ってアプリに届けますが、**確実さを誰が受け持つか**が違います。TCPはOSが全部やり、UDPはアプリに任せます。',
  aspects: [
    { id: 'header', label: 'ヘッダー' },
    { id: 'setup', label: '送り始めるまで' },
    { id: 'reliability', label: '届く保証' },
    { id: 'order', label: '順序' },
    { id: 'boundary', label: 'データの区切り' },
    { id: 'flow', label: '流量の調整' },
    { id: 'use', label: '主な用途' },
  ],
  columns: [
    {
      name: 'UDP',
      lessonId: 'udp',
      cells: {
        header: '8バイト固定',
        setup: 'すぐ送れる(0 RTT)',
        reliability: 'なし。落ちても知らせない',
        order: '保証しない',
        boundary: '送った1回分がそのまま1つのデータグラムで届く',
        flow: 'なし。必要ならアプリが自分で行う',
        use: 'DNS、音声・映像、ゲーム、QUIC の土台',
      },
    },
    {
      name: 'TCP',
      lessonId: 'tcp',
      cells: {
        header: '20バイト + オプション(最大60バイト)',
        setup: '3ウェイハンドシェイクで 1 RTT',
        reliability: 'ACK と再送で全部届ける',
        order: '番号どおりに並べ直して渡す(HOLブロッキングあり)',
        boundary: 'なし。ただのバイトの流れなので、区切りはアプリが決める',
        flow: 'ウィンドウによるフロー制御と、輻輳制御',
        use: 'Web(HTTP/1.1・HTTP/2)、メール、SSH、ファイル転送',
      },
    },
  ],
  notes: ['QUIC は UDP の上で、TCP の確実さを自前で実装し直したものです(第4部)。'],
  lastVerified: '2026-11-06',
};

export default compareTransport;
