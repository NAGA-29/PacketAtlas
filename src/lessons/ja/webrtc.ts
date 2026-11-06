import type { Lesson } from '../types';

const webrtc: Lesson = {
  id: 'webrtc',
  part: 6,
  order: 2,
  title: 'WebRTC',
  tagline: 'ブラウザ同士が直接つながり、音声・映像・データを送り合う',
  lead:
    '**ブラウザ同士が直接つながり、音声・映像・データを送り合う仕組み。**直接つながるまでの段取り(シグナリング、NAT越え、鍵交換)がこのプロトコルの大半です。シグナリングの方式は規格で決まっておらず、多くはWebSocketを使います。',
  overview: {
    layer: 'アプリケーション層(複数のプロトコルの組み合わせ)',
    transport: 'UDP(DTLS・SRTP・SCTP)',
    ports: 'ICE で決まる(STUN / TURN は 3478)',
    format: 'SDP はテキスト、メディアとデータはバイナリ',
    key: { label: '使うプロトコル', value: 'SDP、ICE、STUN、TURN、DTLS、SRTP、SCTP' },
    specs: ['RFC 8445', 'RFC 8489'],
  },
  lanes: [
    { id: 'stun', name: 'STUN / TURN', sub: 'NAT越えの補助' },
    { id: 'a', name: 'Peer A', sub: '発信側' },
    { id: 'sig', name: 'シグナリング', sub: 'WebSocketなど' },
    { id: 'b', name: 'Peer B', sub: '着信側' },
  ],
  steps: [
    {
      id: 'offer',
      title: 'オファーを作って送る',
      hops: [
        { from: 'a', to: 'a', label: 'createOffer()', kind: 'signal' },
        { from: 'a', to: 'sig', label: 'offer (SDP)', kind: 'signal' },
        { from: 'sig', to: 'b', label: 'offer (SDP)', kind: 'signal' },
      ],
      body:
        'Aは「こういうメディアを、こういう条件で送れます」という提案を**SDP**というテキストで作ります。コーデック、暗号化に使う証明書のハッシュ、ICEの認証情報などが入っています。\n\nこの時点ではまだ相手のIPアドレスすら知りません。SDPはシグナリングサーバー経由で届けます。',
      packet: {
        name: 'SDPオファー(抜粋)',
        fields: [
          { name: 'バージョン', text: 'v=0', lineBreak: true },
          { name: '発行元', text: 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', lineBreak: true, desc: 'セッションIDとバージョン' },
          { name: '束ね', text: 'a=group:BUNDLE 0 1', lineBreak: true, desc: '音声とデータを1つの通り道にまとめる' },
          { name: '音声メディア', text: 'm=audio 9 UDP/TLS/RTP/SAVPF 111', lineBreak: true, desc: 'ポート9はダミー。実際の経路はICEで決まる' },
          { name: 'ICEユーザー名', text: 'a=ice-ufrag:bXk1', lineBreak: true, desc: '接続確認のときの認証に使う' },
          { name: 'ICEパスワード', text: 'a=ice-pwd:asd88fgpdd777uzjYhagZg', lineBreak: true, desc: '(例)' },
          { name: '証明書指紋', text: 'a=fingerprint:sha-256 4A:AD:B9:…:58', lineBreak: true, desc: 'DTLSで相手の証明書が本物かを確認する' },
          { name: 'DTLSの役割', text: 'a=setup:actpass', lineBreak: true, desc: 'クライアントにもサーバーにもなれる' },
          { name: 'コーデック', text: 'a=rtpmap:111 opus/48000/2', lineBreak: true, desc: 'ペイロード型111 = Opus' },
          { name: 'データ', text: 'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', lineBreak: true, desc: 'DataChannel用' },
        ],
      },
    },
    {
      id: 'stun',
      title: 'STUNで「外からの自分の住所」を知る',
      hops: [
        { from: 'a', to: 'stun', label: 'Binding Request', kind: 'control' },
        { from: 'stun', to: 'a', label: 'Binding Response', kind: 'control' },
      ],
      body:
        '家庭やオフィスの端末はNATの内側にいて、自分のグローバルIPを知りません。STUNサーバーに問い合わせると「外から見るとあなたは 203.0.113.5:54321 だ」と教えてくれます。これが**srflx候補**になります。\n\nアドレスがXORされているのは、パケット内のIPを書き換えてしまうお節介なNATを避けるためです。',
      packet: {
        name: 'STUN Binding Success Response',
        layers: ['IPv4', 'UDP', 'STUN'],
        fields: [
          { name: 'メッセージ型', hex: '01 01', desc: 'Binding Success Response' },
          { name: 'メッセージ長', hex: '00 0C', desc: 'ヘッダー後の属性部が12バイト' },
          { name: 'マジッククッキー', hex: '21 12 A4 42', desc: '固定値。STUNパケットの識別に使う' },
          { name: 'トランザクションID', hex: 'B7 E7 A7 01 BC 34 D6 86 FA 87 DF AE', desc: 'リクエストと同じ12バイト(RFC 5769 の値)' },
          { name: '属性型', hex: '00 20', desc: 'XOR-MAPPED-ADDRESS' },
          { name: '属性長', hex: '00 08' },
          { name: '予約 + ファミリ', hex: '00 01', desc: 'IPv4' },
          { name: 'ポート(XOR)', hex: 'F5 23', desc: '0xF523 XOR 0x2112 = 54321' },
          { name: 'アドレス(XOR)', hex: 'EA 12 D5 47', desc: 'クッキーとXOR → 203.0.113.5' },
        ],
      },
    },
    {
      id: 'answer',
      title: 'アンサーが返ってくる',
      hops: [
        { from: 'b', to: 'b', label: 'createAnswer()', kind: 'signal' },
        { from: 'b', to: 'sig', label: 'answer (SDP)', kind: 'signal' },
        { from: 'sig', to: 'a', label: 'answer (SDP)', kind: 'signal' },
      ],
      body:
        'Bはオファーの中から自分も使えるものを選び、アンサーを返します。`a=setup:active` で、DTLSハンドシェイクではBがクライアント役になると決まります。\n\nこのオファー/アンサーの往復が「SDPネゴシエーション」です。',
      packet: {
        name: 'SDPアンサー(抜粋)',
        fields: [
          { name: '音声メディア', text: 'm=audio 9 UDP/TLS/RTP/SAVPF 111', lineBreak: true, desc: 'Opusで合意' },
          { name: 'ICEユーザー名', text: 'a=ice-ufrag:Ab3x', lineBreak: true, desc: 'Bの認証情報' },
          { name: 'ICEパスワード', text: 'a=ice-pwd:9uB6L3kQwXzN1fGh7tRpQe', lineBreak: true, desc: '(例)' },
          { name: '証明書指紋', text: 'a=fingerprint:sha-256 9F:02:…:C1', lineBreak: true, desc: 'Bの証明書のハッシュ' },
          { name: 'DTLSの役割', text: 'a=setup:active', lineBreak: true, desc: 'BがDTLSクライアントになる' },
          { name: 'コーデック', text: 'a=rtpmap:111 opus/48000/2', lineBreak: true },
        ],
      },
    },
    {
      id: 'trickle',
      title: '候補アドレスを少しずつ送る(Trickle ICE)',
      hops: [
        { from: 'a', to: 'sig', label: 'candidate', kind: 'signal' },
        { from: 'sig', to: 'b', label: 'candidate', kind: 'signal' },
        { from: 'b', to: 'sig', label: 'candidate', kind: 'signal' },
        { from: 'sig', to: 'a', label: 'candidate', kind: 'signal' },
      ],
      body:
        '候補(candidate)は見つかった順にすぐ送ります。全部揃うのを待たないので接続が速くなります。\n\n候補の型は4種類。LANのアドレスそのまま(`host`)、STUNで分かった外側のアドレス(`srflx`)、通信中に発見したもの(`prflx`)、TURN中継のアドレス(`relay`)です。',
      packet: {
        name: 'ICE candidate',
        fields: [
          { name: 'foundation', text: 'candidate:842163049', desc: '同じ由来の候補をまとめる識別子' },
          { name: 'コンポーネント', text: '1', desc: '1 = RTP' },
          { name: 'トランスポート', text: 'udp' },
          { name: '優先度', text: '1677729535', desc: '型と回線から計算。高いほど先に試す' },
          { name: 'アドレス', text: '203.0.113.5' },
          { name: 'ポート', text: '54321' },
          { name: '型', text: 'typ srflx', desc: 'STUNで分かった外側のアドレス' },
          { name: '関連アドレス', text: 'raddr 192.168.1.10 rport 54321', desc: 'NATの内側の元アドレス(プライベートアドレス)' },
        ],
      },
    },
    {
      id: 'checks',
      title: '経路が通るか総当たりで確かめる',
      hops: [
        { from: 'a', to: 'b', label: 'STUN check', kind: 'control' },
        { from: 'b', to: 'a', label: 'STUN success', kind: 'control' },
        { from: 'b', to: 'a', label: 'STUN check', kind: 'control' },
        { from: 'a', to: 'b', label: 'STUN success', kind: 'control' },
      ],
      body:
        '自分の候補×相手の候補の全ペアに、優先度順でSTUNパケットを直接投げます。双方向に通ったペアが使える経路です。\n\nパケットはSDPで交換したパスワードで署名されるので、第三者は偽の応答を返せません。最後にcontrolling側(ここではA)が経路を1つ選んで確定します。',
      packet: {
        name: 'STUN Binding Request(ICE接続確認)',
        layers: ['IPv4', 'UDP', 'STUN'],
        note: '属性は「型・長さ」の4バイトだけを示し、値は省略しています。',
        fields: [
          { name: 'メッセージ型', hex: '00 01', desc: 'Binding Request' },
          { name: 'メッセージ長', hex: '00 44', desc: '属性部 68バイト' },
          { name: 'マジッククッキー', hex: '21 12 A4 42' },
          { name: 'トランザクションID', hex: '6A 1F 0B … 3C', desc: '12バイト(省略)' },
          { name: 'USERNAME', hex: '00 06 00 09', desc: '値は「Ab3x:bXk1」(相手のufrag:自分のufrag)' },
          { name: 'PRIORITY', hex: '00 24 00 04', desc: 'この経路が選ばれたときの優先度' },
          { name: 'ICE-CONTROLLING', hex: '80 2A 00 08', desc: 'Aが最終的な経路を決める側' },
          { name: 'MESSAGE-INTEGRITY', hex: '00 08 00 14', desc: '相手の ice-pwd で計算したHMAC-SHA1' },
          { name: 'FINGERPRINT', hex: '80 28 00 04', desc: 'CRC-32。他のプロトコルと区別する' },
        ],
      },
    },
    {
      id: 'dtls',
      title: 'DTLSで鍵を交換する',
      hops: [
        { from: 'b', to: 'a', label: 'ClientHello', kind: 'control' },
        { from: 'a', to: 'b', label: 'ServerHello … Done', kind: 'control' },
        { from: 'b', to: 'a', label: 'Certificate … Finished', kind: 'control' },
        { from: 'a', to: 'b', label: 'Finished', kind: 'control' },
      ],
      body:
        'DTLSはUDP版のTLSです。パケットが落ちても自前の再送タイマーでハンドシェイクを続けられます。\n\n証明書は自己署名ですが、そのハッシュをSDPの `a=fingerprint` と照合することで「シグナリングで話した相手と同じ」と確かめます。ここで得た鍵がSRTPとDataChannelの暗号化に使われます。',
      packet: {
        name: 'DTLSレコード(ClientHello)',
        layers: ['IPv4', 'UDP', 'DTLS'],
        fields: [
          { name: 'コンテンツタイプ', hex: '16', desc: '22 = Handshake' },
          { name: 'バージョン', hex: 'FE FD', desc: 'DTLS 1.2(TLSのバージョンの補数で表す)' },
          { name: 'エポック', hex: '00 00', desc: '鍵が切り替わるたびに増える' },
          { name: 'シーケンス番号', hex: '00 00 00 00 00 00', desc: 'UDPなので並べ替え・重複検出用に明示' },
          { name: '長さ', hex: '00 B4', desc: '(例)' },
          { name: 'ハンドシェイク型', hex: '01', desc: 'ClientHello' },
        ],
      },
    },
    {
      id: 'srtp',
      title: 'SRTPで音声・映像が流れる',
      hops: [
        { from: 'a', to: 'b', label: 'SRTP 音声', kind: 'media' },
        { from: 'b', to: 'a', label: 'SRTP 映像', kind: 'media' },
        { from: 'a', to: 'b', label: 'SRTP 音声', kind: 'media' },
      ],
      body:
        'ここからが本番。RTPヘッダーは平文で、中身だけが暗号化されています。受信側はシーケンス番号とタイムスタンプでジッターバッファを組み、到着順のばらつきを吸収します。\n\n落ちたパケットは基本的に再送しません。遅れて届いた音は役に立たないからです。代わりにFEC(冗長データ)や、映像ならNACKでの限定的な再送を使います。',
      packet: {
        name: 'SRTPパケット',
        layers: ['IPv4', 'UDP', 'SRTP'],
        fields: [
          {
            name: 'V / P / X / CC',
            hex: '80',
            desc: 'バージョン2、パディング・拡張なし',
            bits: [
              { name: 'V', bits: 2, desc: 'バージョン = 2' },
              { name: 'P', bits: 1, desc: 'パディング' },
              { name: 'X', bits: 1, desc: '拡張ヘッダー' },
              { name: 'CC', bits: 4, desc: 'CSRCの数' },
            ],
          },
          {
            name: 'M / ペイロード型',
            hex: '6F',
            desc: 'PT=111(SDPでOpusと合意した番号)',
            bits: [
              { name: 'M', bits: 1, desc: 'マーカー' },
              { name: 'PT', bits: 7, desc: 'ペイロード型' },
            ],
          },
          { name: 'シーケンス番号', hex: '1A 2B', desc: '1パケットごとに+1。ロスと順序の検出に使う' },
          { name: 'タイムスタンプ', hex: '00 00 3C 00', desc: '48kHzのサンプル単位。20msごとに+960' },
          { name: 'SSRC', hex: '12 34 56 78', desc: 'ストリームの識別子(例)' },
          { name: '暗号化ペイロード', hex: '9C E1 … 07', desc: '暗号化されたOpusフレーム(例)' },
          { name: '認証タグ', hex: 'D4 0A … 6E', desc: '改ざん検知用(例)' },
        ],
      },
    },
    {
      id: 'datachannel',
      title: 'DataChannelを開く',
      hops: [
        { from: 'a', to: 'b', label: 'DATA_CHANNEL_OPEN', kind: 'data' },
        { from: 'b', to: 'a', label: 'DATA_CHANNEL_ACK', kind: 'data' },
      ],
      body:
        'DataChannelはUDP → DTLS → SCTP の上に乗った任意データの通り道です。チャネルごとに「順序を保証するか」「何回まで再送するか」を選べます。\n\n`{ordered:false, maxRetransmits:0}` にすればUDPのような使い方になり、ゲームの位置同期に向きます。',
      packet: {
        name: 'DCEP DATA_CHANNEL_OPEN',
        layers: ['IPv4', 'UDP', 'DTLS', 'SCTP', 'DCEP'],
        view: 'decrypted',
        fields: [
          { name: 'メッセージ型', hex: '03', desc: 'DATA_CHANNEL_OPEN' },
          { name: 'チャネル型', hex: '00', desc: '0x00 = 信頼・順序保証。0x81なら再送回数制限・順不同' },
          { name: '優先度', hex: '00 00' },
          { name: '信頼性パラメータ', hex: '00 00 00 00', desc: '再送回数、または寿命(ms)' },
          { name: 'ラベル長', hex: '00 04' },
          { name: 'プロトコル長', hex: '00 00' },
          { name: 'ラベル', hex: '63 68 61 74', desc: '「chat」' },
        ],
      },
    },
    {
      id: 'turn',
      title: '直接つながらないときはTURNで中継',
      hops: [
        { from: 'a', to: 'stun', label: 'Allocate', kind: 'control' },
        { from: 'stun', to: 'a', label: 'Allocate Success', kind: 'control' },
        { from: 'a', to: 'stun', label: 'ChannelData', kind: 'media' },
        { from: 'stun', to: 'b', label: 'UDP', kind: 'media' },
      ],
      body:
        '両者が厳しいNATやファイアウォールの内側にいると、P2Pの経路がひとつも通りません。そのときはTURNサーバーにアドレスを借りて、全パケットを中継してもらいます。\n\n中身はDTLS/SRTPのままなのでTURNには読めません。ただしサーバーの帯域を食うので、運用コストの大部分はここにかかります。',
      packet: {
        name: 'TURN ChannelData',
        layers: ['IPv4', 'UDP', 'TURN'],
        note: 'ChannelDataのヘッダーは4バイト。Send Indication(36バイト以上)より軽いので、継続的な中継ではこちらを使います。',
        fields: [
          { name: 'チャネル番号', hex: '40 00', desc: '0x4000〜0x4FFF。ChannelBindで相手アドレスと紐付け済み' },
          { name: '長さ', hex: '00 64', desc: '中身100バイト' },
          { name: 'データ', hex: '80 6F 1A 2C …', desc: '中継されるSRTPパケットそのもの' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 9429 JSEP(RFC 8829 を改訂)', url: 'https://www.rfc-editor.org/rfc/rfc9429' },
    { label: 'RFC 8445 ICE', url: 'https://www.rfc-editor.org/rfc/rfc8445' },
    { label: 'RFC 8838 Trickle ICE', url: 'https://www.rfc-editor.org/rfc/rfc8838' },
    { label: 'RFC 8489 STUN', url: 'https://www.rfc-editor.org/rfc/rfc8489' },
    { label: 'RFC 5769 STUN のテストベクター', url: 'https://www.rfc-editor.org/rfc/rfc5769' },
    { label: 'RFC 8656 TURN', url: 'https://www.rfc-editor.org/rfc/rfc8656' },
    { label: 'RFC 6347 DTLS 1.2', url: 'https://www.rfc-editor.org/rfc/rfc6347' },
    { label: 'RFC 3550 RTP', url: 'https://www.rfc-editor.org/rfc/rfc3550' },
    { label: 'RFC 3711 SRTP', url: 'https://www.rfc-editor.org/rfc/rfc3711' },
    { label: 'RFC 8832 DCEP', url: 'https://www.rfc-editor.org/rfc/rfc8832' },
  ],
  lastVerified: '2026-11-06',
};

export default webrtc;
