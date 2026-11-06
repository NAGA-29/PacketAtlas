import type { CompareTable } from '../types';

const compareNamingSecurity: CompareTable = {
  part: 3,
  title: 'DNS の運び方の比較',
  lead: 'DNSの問い合わせは長いあいだ平文で流れていました。**TLSやQUICで包む**と、経路の途中から「どの名前を引いたか」が見えなくなります。',
  aspects: [
    { id: 'transport', label: '運び方' },
    { id: 'port', label: 'ポート' },
    { id: 'privacy', label: '盗聴・改ざん' },
    { id: 'cost', label: '1回目の往復' },
    { id: 'block', label: '見分けやすさ' },
    { id: 'rfc', label: '仕様' },
  ],
  columns: [
    {
      name: 'DNS(UDP / TCP)',
      lessonId: 'dns',
      cells: {
        transport: 'ふつうはUDP。大きい応答やゾーン転送はTCP',
        port: '53',
        privacy: '平文。経路上で読める・書き換えられる',
        cost: 'UDPなら 1 RTT',
        block: '53番なので簡単に見分けられる',
        rfc: 'RFC 1035、RFC 7766(TCP)',
      },
    },
    {
      name: 'DNS over TLS(DoT)',
      lessonId: 'tls13',
      cells: {
        transport: 'TCP + TLS',
        port: '853',
        privacy: '暗号化され、サーバーも証明書で確かめられる',
        cost: 'TCP 1 + TLS 1 + 問い合わせ 1 = 3 RTT(接続を使い回せば 1 RTT)',
        block: '専用ポートなので止めやすい',
        rfc: 'RFC 7858',
      },
    },
    {
      name: 'DNS over HTTPS(DoH)',
      cells: {
        transport: 'HTTP/2 や HTTP/3 の上',
        port: '443',
        privacy: '暗号化される',
        cost: 'DoT と同じ程度。ブラウザの既存の接続に相乗りできる',
        block: 'ふつうのHTTPSと見分けにくい',
        rfc: 'RFC 8484',
      },
    },
    {
      name: 'DNS over QUIC(DoQ)',
      cells: {
        transport: 'QUIC(UDP)',
        port: '853(UDP)',
        privacy: '暗号化される',
        cost: 'QUIC + TLS 1 + 問い合わせ 1 = 2 RTT',
        block: '専用ポートなので止めやすい',
        rfc: 'RFC 9250',
      },
    },
  ],
  notes: ['暗号化されるのは端末とリゾルバーのあいだです。リゾルバー自身には問い合わせた名前が見えます。'],
  lastVerified: '2026-11-06',
};

export default compareNamingSecurity;
