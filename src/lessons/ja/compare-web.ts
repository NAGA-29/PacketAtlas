import type { CompareTable } from '../types';

const compareWeb: CompareTable = {
  part: 4,
  title: 'HTTP の3つの版の比較',
  lead: 'メソッド、ステータス、ヘッダーという**HTTPの意味はどの版でも同じ**です。違うのは、それをどう刻んで、何の上で運ぶかです。',
  aspects: [
    { id: 'transport', label: '土台' },
    { id: 'format', label: '形式' },
    { id: 'parallel', label: '並行して頼む' },
    { id: 'headers', label: 'ヘッダー' },
    { id: 'hol', label: '1つ落ちたとき' },
    { id: 'setup', label: '最初の応答まで' },
    { id: 'migration', label: '回線が変わったら' },
  ],
  columns: [
    {
      name: 'HTTP/1.1',
      lessonId: 'http11',
      cells: {
        transport: 'TCP(+ TLS)',
        format: 'テキスト',
        parallel: '1接続で1つずつ。接続を6本ほど並べる',
        headers: '毎回テキストで全部送る',
        hol: 'その接続のやり取りが全部待つ',
        setup: 'TCP 1 + TLS 1 + HTTP 1 = 3 RTT',
        migration: '接続が切れる',
      },
    },
    {
      name: 'HTTP/2',
      lessonId: 'http2',
      cells: {
        transport: 'TCP + TLS',
        format: 'バイナリのフレーム',
        parallel: '1接続に多数のストリームを多重化',
        headers: 'HPACK(静的・動的テーブル)',
        hol: 'TCPの層で全ストリームが待つ',
        setup: '3 RTT(HTTP/1.1 と同じ)',
        migration: '接続が切れる',
      },
    },
    {
      name: 'HTTP/3',
      lessonId: 'http3',
      cells: {
        transport: 'QUIC(UDP)。TLS 1.3 を内蔵',
        format: 'バイナリのフレーム(QUIC のストリームの上)',
        parallel: '独立した QUIC ストリーム',
        headers: 'QPACK(順番が入れ替わっても壊れないよう工夫)',
        hol: '落ちたパケットのストリームだけが待つ',
        setup: 'QUIC 1 + HTTP 1 = 2 RTT(再開なら 0-RTT も)',
        migration: '接続IDで続けられる',
      },
    },
  ],
  notes: ['RTT はDNSを除いた初回接続の目安です。'],
  lastVerified: '2026-11-06',
};

export default compareWeb;
