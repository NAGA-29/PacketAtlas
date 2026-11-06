import type { Lesson } from '../types';

const http3: Lesson = {
  id: 'http3',
  part: 4,
  order: 4,
  title: 'HTTP/3 と QUIC',
  tagline: 'UDPの上でTCPの弱点を解く',
  lead:
    '**TCP と TLS をやめ、UDP の上の QUIC で HTTP を運ぶ新しい版。**QUIC は接続確立と暗号化を1往復でまとめ、ストリームを独立させて「1つ落ちると全部止まる」問題を解きます。HTTP の意味は HTTP/2 と同じで、ヘッダー圧縮は QPACK に変わりました。',
  lanes: [
    { id: 'browser', name: 'ブラウザ', sub: 'UDP 50003' },
    { id: 'server', name: 'サーバー', sub: 'example.com:443(UDP)' },
  ],
  steps: [
    {
      id: 'alt-svc',
      title: 'HTTP/3 が使えると知る',
      hops: [{ from: 'server', to: 'browser', label: 'Alt-Svc: h3', kind: 'control' }],
      body:
        'ブラウザは最初、そのサーバーが HTTP/3 を話せるか知りません。HTTP/2 などのレスポンスに付いた `Alt-Svc` ヘッダーを見て、次からは UDP の443番で HTTP/3 を試します。\n\nDNS の HTTPS レコードで最初から知らせる方法もあります。UDP が通らないネットワークでは、黙って HTTP/2 に戻ります。',
      packet: {
        name: 'レスポンスヘッダー(HTTP/2 で受け取ったもの)',
        fields: [
          { name: ':status', text: ':status = 200', lineBreak: true },
          { name: 'alt-svc', text: 'alt-svc = h3=":443"; ma=86400', lineBreak: true, desc: '同じホストの443番で h3 が使える。86400秒覚えておいてよい' },
        ],
      },
    },
    {
      id: 'initial',
      title: 'Initial:QUIC と TLS の握手を同時に始める',
      hops: [{ from: 'browser', to: 'server', label: 'Initial: ClientHello', kind: 'control' }],
      body:
        'QUIC は TLS 1.3 の ClientHello を **CRYPTO フレーム**に入れて運びます。TCPの握手を待たないので、最初のパケットからもう鍵交換が始まっています。\n\nInitial パケットは接続IDから誰でも計算できる鍵で守られているだけなので、暗号化というより改ざん検知と目隠しです。ALPN には `h3` が入ります。',
      packet: {
        name: 'CRYPTO フレーム(Initial の中、保護を外した後)',
        layers: ['IPv4', 'UDP', 'QUIC', 'TLS'],
        view: 'decrypted',
        fields: [
          { name: 'フレーム型', hex: '06', desc: 'CRYPTO' },
          { name: 'オフセット', hex: '00', desc: 'TLSのバイト列の先頭から' },
          { name: '長さ', hex: '40 F1', desc: '2バイトvarint → 241バイト' },
          { name: 'ハンドシェイク型・長さ', hex: '01 00 00 ED', desc: 'ClientHello、237バイト(例)' },
          { name: 'legacy_version', hex: '03 03' },
          { name: 'random 〜 他の拡張', hex: '…', desc: 'TLS 1.3 の章の ClientHello とほぼ同じ' },
          { name: 'ALPN', hex: '00 10 00 05 00 03 02 68 33', desc: '「h3」だけを提示' },
        ],
      },
    },
    {
      id: 'handshake',
      title: '1往復で暗号化された接続ができる',
      hops: [
        { from: 'server', to: 'browser', label: 'Initial + Handshake', kind: 'control' },
        { from: 'browser', to: 'server', label: 'Handshake: Finished', kind: 'control' },
      ],
      body:
        'サーバーは ServerHello を Initial パケットで、証明書から Finished までを **Handshake** パケットで返します。両方を1つのUDPデータグラムにまとめて送れます。\n\nTCP + TLS 1.3 なら2往復のところ、ここまで1往復。ブラウザは Finished を送ったら、すぐにリクエストを続けられます。',
      packet: {
        name: 'Handshake パケットのヘッダー',
        layers: ['IPv4', 'UDP', 'QUIC'],
        fields: [
          {
            name: '先頭バイト',
            hex: 'E1',
            desc: 'ロングヘッダー、タイプ=Handshake、PN長2バイト',
            bits: [
              { name: 'Header Form', bits: 1, desc: '1 = ロング' },
              { name: 'Fixed Bit', bits: 1 },
              { name: 'Type', bits: 2, desc: '10 = Handshake' },
              { name: 'Reserved', bits: 2 },
              { name: 'PN Length', bits: 2, desc: '値+1 = 2バイト' },
            ],
          },
          { name: 'バージョン', hex: '00 00 00 01', desc: 'QUIC v1' },
          { name: '宛先CID長', hex: '08' },
          { name: '宛先CID', hex: 'F0 67 A5 50 2A 42 62 B5', desc: 'ブラウザが選んだ接続ID(例)' },
          { name: '送信元CID長', hex: '08' },
          { name: '送信元CID', hex: '5A 4B 3C 2D 1E 0F 00 11', desc: 'サーバーが選んだ接続ID(例)' },
          { name: '長さ', hex: '41 0A', desc: 'varint → 266バイト(例)' },
          { name: 'パケット番号', hex: '00 01', desc: 'ヘッダー保護で隠される' },
          { name: '暗号化ペイロード', hex: '…', desc: 'CRYPTOフレーム(Certificate … Finished)' },
        ],
      },
    },
    {
      id: 'control',
      title: '制御ストリームで設定を伝える',
      hops: [
        { from: 'browser', to: 'server', label: 'control: SETTINGS', kind: 'control' },
        { from: 'server', to: 'browser', label: 'control: SETTINGS', kind: 'control' },
      ],
      body:
        'HTTP/3 では、両側がまず一方向の**制御ストリーム**を1本ずつ開き、SETTINGS フレームを送ります。HTTP/2 では接続全体の話をストリーム0で扱いましたが、QUIC ではストリームの種類を先頭のバイトで示します。\n\nここでは QPACK の動的テーブルを使わない(容量0)と伝えています。',
      packet: {
        name: 'STREAM フレーム(制御ストリーム)',
        layers: ['IPv4', 'UDP', 'QUIC', 'HTTP/3'],
        view: 'decrypted',
        fields: [
          { name: 'フレーム型', hex: '0A', desc: 'QUIC の STREAM(長さあり)' },
          { name: 'ストリームID', hex: '02', desc: 'クライアントが開いた一方向ストリーム' },
          { name: '長さ', hex: '07' },
          { name: 'ストリーム種別', hex: '00', desc: '0 = 制御ストリーム' },
          { name: 'H3 フレーム型・長さ', hex: '04 04', desc: 'SETTINGS、4バイト' },
          { name: 'QPACK_MAX_TABLE_CAPACITY', hex: '01 00', desc: '動的テーブルの容量 0' },
          { name: 'QPACK_BLOCKED_STREAMS', hex: '07 00', desc: '0' },
        ],
      },
    },
    {
      id: 'request',
      title: 'リクエスト1つに双方向ストリーム1本',
      hops: [
        { from: 'browser', to: 'server', label: 'stream 0: HEADERS', kind: 'data' },
        { from: 'browser', to: 'server', label: 'stream 4: HEADERS', kind: 'data' },
        { from: 'server', to: 'browser', label: 'stream 0: HEADERS + DATA', kind: 'data' },
      ],
      body:
        'リクエストごとに、クライアントが双方向ストリームを1本開きます(0, 4, 8…)。HTTP/2 のストリームIDとフレームの役目は、QUIC のストリームが引き受けました。\n\nヘッダーは **QPACK** で圧縮します。静的テーブルの番号なら1バイトです。ストリームの終わりは QUIC の FIN ビットで示します。',
      packet: {
        name: 'STREAM フレーム(リクエスト)',
        layers: ['IPv4', 'UDP', 'QUIC', 'HTTP/3'],
        view: 'decrypted',
        note: '文字列はハフマン符号を使わない形で示しています。',
        fields: [
          {
            name: 'フレーム型',
            hex: '0B',
            desc: 'STREAM、長さあり、FIN',
            bits: [
              { name: 'STREAM', bits: 5 },
              { name: 'OFF', bits: 1 },
              { name: 'LEN', bits: 1 },
              { name: 'FIN', bits: 1, desc: 'リクエストはこれで全部' },
            ],
          },
          { name: 'ストリームID', hex: '00', desc: '最初の双方向ストリーム' },
          { name: '長さ', hex: '14', desc: '20バイト' },
          { name: 'H3 フレーム型・長さ', hex: '01 12', desc: 'HEADERS、18バイト' },
          { name: 'QPACK 接頭辞', hex: '00 00', desc: '動的テーブルを参照しない' },
          { name: ':method GET', hex: 'D1', desc: '静的テーブル17番(11xxxxxx)' },
          { name: ':scheme https', hex: 'D7', desc: '静的テーブル23番' },
          { name: ':path /', hex: 'C1', desc: '静的テーブル1番' },
          { name: ':authority', hex: '50 0B 65 78 61 6D 70 6C 65 2E 63 6F 6D', desc: '名前は静的テーブル0番、値「example.com」' },
        ],
      },
    },
    {
      id: 'no-hol',
      title: '落ちても他のストリームは止まらない',
      hops: [
        { from: 'server', to: 'browser', label: '#6 stream 4', kind: 'data', lost: true },
        { from: 'server', to: 'browser', label: '#7〜#10 stream 0', kind: 'data' },
        { from: 'browser', to: 'server', label: 'ACK(#6 が欠け)', kind: 'control' },
        { from: 'server', to: 'browser', label: '#11 stream 4 再送', kind: 'data' },
      ],
      body:
        'パケット #6(ストリーム4のデータ)が落ちました。でも #7〜#10 で届いたストリーム0のデータは、すぐアプリに渡せます。止まるのはストリーム4だけです。HTTP/2 の TCP で起きた全体の停止はありません。\n\nQUIC は再送のときも新しいパケット番号(#11)を使います。番号が重ならないので、どの送信に対する ACK かが曖昧になりません。',
      packet: {
        name: 'ACK フレーム',
        layers: ['IPv4', 'UDP', 'QUIC'],
        view: 'decrypted',
        fields: [
          { name: 'フレーム型', hex: '02', desc: 'ACK' },
          { name: '最大の番号', hex: '0A', desc: '#10 まで見えている' },
          { name: 'ACK遅延', hex: '19', desc: '25(単位は 2^3 マイクロ秒が既定 → 200μs)' },
          { name: '範囲の数', hex: '01', desc: '最初の範囲の後に、もう1つ' },
          { name: '最初の範囲', hex: '03', desc: '#10 から3つ前まで → #7〜#10' },
          { name: 'すき間', hex: '00', desc: '0 + 1 = 1個欠け → #6' },
          { name: '次の範囲', hex: '05', desc: '#5 から5つ前まで → #0〜#5' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9114 HTTP/3', url: 'https://www.rfc-editor.org/rfc/rfc9114' },
    { label: 'RFC 9000 QUIC', url: 'https://www.rfc-editor.org/rfc/rfc9000' },
    { label: 'RFC 9001 QUIC と TLS', url: 'https://www.rfc-editor.org/rfc/rfc9001' },
    { label: 'RFC 9002 QUIC の損失検出と輻輳制御', url: 'https://www.rfc-editor.org/rfc/rfc9002' },
    { label: 'RFC 9204 QPACK', url: 'https://www.rfc-editor.org/rfc/rfc9204' },
    { label: 'RFC 7838 HTTP Alternative Services', url: 'https://www.rfc-editor.org/rfc/rfc7838' },
  ],
  lastVerified: '2026-11-06',
};

export default http3;
