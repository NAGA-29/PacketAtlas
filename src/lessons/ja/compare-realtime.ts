import type { CompareTable } from '../types';

const compareRealtime: CompareTable = {
  part: 6,
  title: 'リアルタイム4方式の比較',
  lead: '同じ「リアルタイム」でも、何を犠牲にして何を得るかは方式ごとに違います。**届く保証と遅延のどちらを取るか**、そして**ブラウザで使えるか**で選び分けます。',
  aspects: [
    { id: 'base', label: '土台' },
    { id: 'setup', label: '接続までの往復' },
    { id: 'reliability', label: '信頼性と順序' },
    { id: 'hol', label: '1つ落ちたとき' },
    { id: 'nat', label: 'NAT越え' },
    { id: 'browser', label: 'ブラウザ対応' },
    { id: 'use', label: '向いている用途' },
  ],
  columns: [
    {
      name: 'WebSocket',
      lessonId: 'websocket',
      cells: {
        base: 'TCP(+TLS)の上。HTTP/1.1 の Upgrade で始まる',
        setup: 'TCP 1 + TLS 1 + Upgrade 1 = 約3 RTT',
        reliability: '全部届き、順序も保証',
        hol: '後ろのデータが全部待たされる(HOLブロッキング)',
        nat: '不要。クライアントからサーバーへ普通に接続する',
        browser: '主要ブラウザすべて',
        use: 'チャット、通知、ターン制ゲーム、シグナリング',
      },
    },
    {
      name: 'WebRTC',
      lessonId: 'webrtc',
      cells: {
        base: 'UDPの上に DTLS、SRTP(メディア)、SCTP(データ)',
        setup: 'シグナリング + ICE + DTLS。数百ms〜数秒',
        reliability: 'メディアは再送しない。DataChannel はチャネルごとに選べる',
        hol: 'メディアは止まらない。順不同の DataChannel も止まらない',
        nat: 'ICE(STUN / TURN)で越える。だめなら TURN で中継',
        browser: '主要ブラウザすべて',
        use: '通話、ビデオ会議、画面共有、P2P のデータ交換',
      },
    },
    {
      name: 'ゲームのネットコード',
      lessonId: 'game',
      cells: {
        base: '生のUDPの上に自作のプロトコル',
        setup: 'チャレンジ込みで約2 RTT(自分で設計する)',
        reliability: '基本は届かなくてよい。必要なメッセージだけ ack で再送',
        hol: '止まらない。古い状態は捨てて最新を使う',
        nat: 'サーバー型なら不要。P2P なら自前でホールパンチング',
        browser: '不可(ネイティブアプリのみ)',
        use: '対戦アクション、FPS、格闘ゲーム',
      },
    },
    {
      name: 'WebTransport',
      lessonId: 'webtransport',
      cells: {
        base: 'QUIC(HTTP/3)の上。拡張 CONNECT で始まる',
        setup: 'QUIC + TLS 1 RTT + CONNECT 1 = 約2 RTT',
        reliability: 'データグラムは再送なし、ストリームは全部届き順序保証',
        hol: 'ストリーム同士は独立していて、他のストリームは止まらない',
        nat: '不要。ただしUDPを通さないネットワークでは使えない',
        browser: 'Chromium系(Chrome・Edge)と Firefox。Safari は最新の対応状況を確認',
        use: 'ブラウザゲーム、ライブ配信、WebSocket の置き換え',
      },
    },
  ],
  notes: [
    'RTT の数は初回接続の目安です。TLS や QUIC の再開(0-RTT)を使うと減ります。',
    'ゲームのネットコードはこのサイトの架空フォーマットを前提にしています。',
  ],
  lastVerified: '2026-11-06',
};

export default compareRealtime;
