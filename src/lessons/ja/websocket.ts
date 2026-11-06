import type { Lesson } from '../types';

const websocket: Lesson = {
  id: 'websocket',
  part: 6,
  order: 1,
  title: 'WebSocket',
  tagline: 'HTTPで始まり、1本のTCP接続を双方向の通り道に変える',
  lead:
    '**HTTPで始まり、1本のTCP接続を双方向の通り道に変えるプロトコル。**チャット、通知、ターン制ゲーム、シグナリングサーバーの定番です。TCPの上なので届く順番と到着は保証されますが、1つ落ちると後ろが全部待たされます。',
  lanes: [
    { id: 'client', name: 'ブラウザ', sub: 'new WebSocket()' },
    { id: 'server', name: 'サーバー', sub: 'ws://example.com/chat' },
  ],
  steps: [
    {
      id: 'tcp',
      title: 'TCP接続を張る',
      hops: [
        { from: 'client', to: 'server', label: 'SYN', kind: 'control' },
        { from: 'server', to: 'client', label: 'SYN-ACK', kind: 'control' },
        { from: 'client', to: 'server', label: 'ACK', kind: 'control' },
      ],
      body:
        'WebSocketはTCPの上で動きます。まず3ウェイハンドシェイクで1往復(1 RTT)。`wss://` ならこの後TLSハンドシェイクでさらに1往復かかります。\n\nここで張った1本の接続を、切断するまで使い続けるのがWebSocketの特徴です。',
      packet: {
        name: 'TCPヘッダー(SYN)',
        layers: ['IPv4', 'TCP'],
        fields: [
          { name: '送信元ポート', hex: 'C3 50', desc: '50000。OSが選ぶ一時ポート' },
          { name: '宛先ポート', hex: '00 50', desc: '80番(wss なら 443)' },
          { name: 'シーケンス番号', hex: '1A 2B 3C 4D', desc: 'ランダムな初期値(例)' },
          { name: '確認応答番号', hex: '00 00 00 00', desc: 'SYNではまだ使わない' },
          {
            name: 'データオフセット',
            hex: '50',
            desc: '上位4bitが5 → ヘッダー長20バイト',
            bits: [
              { name: 'Data Offset', bits: 4, desc: '32bit単位のヘッダー長' },
              { name: 'Reserved', bits: 4, desc: '予約' },
            ],
          },
          {
            name: 'フラグ',
            hex: '02',
            desc: 'SYNビットだけが立っている',
            bits: [
              { name: 'CWR', bits: 1 },
              { name: 'ECE', bits: 1 },
              { name: 'URG', bits: 1 },
              { name: 'ACK', bits: 1 },
              { name: 'PSH', bits: 1 },
              { name: 'RST', bits: 1 },
              { name: 'SYN', bits: 1, desc: '接続開始' },
              { name: 'FIN', bits: 1 },
            ],
          },
          { name: 'ウィンドウ', hex: 'FF FF', desc: '一度に受け取れる量の目安' },
          { name: 'チェックサム', hex: 'B1 7E', desc: '検査値(例)' },
          { name: '緊急ポインタ', hex: '00 00', desc: 'ほぼ使われない' },
        ],
      },
    },
    {
      id: 'upgrade',
      title: 'HTTPで「アップグレードしたい」と頼む',
      hops: [{ from: 'client', to: 'server', label: 'GET /chat Upgrade', kind: 'control' }],
      body:
        '最初のリクエストは普通のHTTP GETです。だからプロキシやロードバランサーを通りやすい。`Upgrade: websocket` で別プロトコルへの切り替えを求めます。\n\n`Sec-WebSocket-Key` は16バイトの乱数をBase64にしたもの。認証ではなく、WebSocketを理解しないサーバーやキャッシュが誤って応答するのを防ぐためのものです。',
      packet: {
        name: 'HTTPリクエスト(テキスト)',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'リクエスト行', text: 'GET /chat HTTP/1.1', lineBreak: true, desc: '普通のHTTP GETとして始まる' },
          { name: 'Host', text: 'Host: example.com', lineBreak: true },
          { name: 'Upgrade', text: 'Upgrade: websocket', lineBreak: true, desc: 'プロトコルの切り替えを要求' },
          { name: 'Connection', text: 'Connection: Upgrade', lineBreak: true, desc: 'Upgradeヘッダーを処理せよという合図' },
          { name: 'Key', text: 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', lineBreak: true, desc: '16バイト乱数のBase64(RFC 6455 の例)' },
          { name: 'Version', text: 'Sec-WebSocket-Version: 13', lineBreak: true, desc: 'RFC 6455' },
          { name: 'Origin', text: 'Origin: https://example.com', lineBreak: true, desc: 'サーバー側でオリジン検証に使う' },
          { name: '空行', text: '␍␊', lineBreak: true, desc: 'ヘッダーの終わり' },
        ],
      },
    },
    {
      id: 'switching',
      title: '101 Switching Protocols',
      hops: [{ from: 'server', to: 'client', label: '101 Switching', kind: 'control' }],
      body:
        'サーバーが了承すると `101` を返し、この応答を最後にHTTPは終わります。以降同じTCP接続を流れるのはWebSocketフレームだけです。\n\n`Sec-WebSocket-Accept` はKeyに固定のGUIDをつないでSHA-1を取り、Base64にした値。クライアントは自分で計算して一致を確かめます。',
      packet: {
        name: 'HTTPレスポンス(テキスト)',
        layers: ['IPv4', 'TCP', 'HTTP/1.1'],
        fields: [
          { name: 'ステータス行', text: 'HTTP/1.1 101 Switching Protocols', lineBreak: true, desc: 'これ以降はHTTPではなくなる' },
          { name: 'Upgrade', text: 'Upgrade: websocket', lineBreak: true },
          { name: 'Connection', text: 'Connection: Upgrade', lineBreak: true },
          {
            name: 'Accept',
            text: 'Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
            lineBreak: true,
            desc: 'Key + 258EAFA5-E914-47DA-95CA-C5AB0DC85B11 → SHA-1 → Base64',
          },
          { name: '空行', text: '␍␊', lineBreak: true },
        ],
      },
    },
    {
      id: 'client-text',
      title: 'クライアントがテキストを送る(マスクあり)',
      hops: [{ from: 'client', to: 'server', label: 'Text「Hello」', kind: 'data' }],
      body:
        'ヘッダーはたった2〜14バイト。HTTPリクエストを毎回送るのに比べて圧倒的に軽量です。\n\nクライアント→サーバーのフレームは必ず**マスク**されます。ペイロードを4バイトのランダムな鍵とXORする仕組みで、暗号化ではありません。中間プロキシが中身をHTTPと誤解して汚染される攻撃を防ぐためです。',
      packet: {
        name: 'WebSocketフレーム',
        layers: ['IPv4', 'TCP', 'WebSocket'],
        fields: [
          {
            name: 'FIN + opcode',
            hex: '81',
            desc: 'FIN=1(最後の断片)、opcode=0x1(テキスト)',
            bits: [
              { name: 'FIN', bits: 1, desc: '最後の断片' },
              { name: 'RSV1-3', bits: 3, desc: '拡張用。通常0' },
              { name: 'opcode', bits: 4, desc: '0x1 = テキスト' },
            ],
          },
          {
            name: 'MASK + 長さ',
            hex: '85',
            desc: 'MASK=1、ペイロード長=5',
            bits: [
              { name: 'MASK', bits: 1, desc: 'マスクあり' },
              { name: 'Payload len', bits: 7, desc: '0〜125はそのまま長さ' },
            ],
          },
          { name: 'マスキングキー', hex: '37 FA 21 3D', desc: 'フレームごとに作るランダムな4バイト(RFC 6455 の例)' },
          { name: 'ペイロード(マスク済み)', hex: '7F 9F 4D 51 58', desc: '「Hello」の i 番目のバイトを key[i mod 4] とXOR' },
        ],
      },
    },
    {
      id: 'server-text',
      title: 'サーバーがテキストを返す(マスクなし)',
      hops: [{ from: 'server', to: 'client', label: 'Text「Hello」', kind: 'data' }],
      body:
        'サーバー→クライアントはマスクなし。中身がそのまま見えます。\n\n長さが125以下なら2バイト目に直接入ります。126なら続く2バイト、127なら続く8バイトが本当の長さです。',
      packet: {
        name: 'WebSocketフレーム',
        layers: ['IPv4', 'TCP', 'WebSocket'],
        fields: [
          { name: 'FIN + opcode', hex: '81', desc: 'テキストフレーム' },
          {
            name: 'MASK + 長さ',
            hex: '05',
            desc: 'MASK=0、長さ5',
            bits: [
              { name: 'MASK', bits: 1, desc: 'マスクなし' },
              { name: 'Payload len', bits: 7 },
            ],
          },
          { name: 'ペイロード', hex: '48 65 6C 6C 6F', desc: '「Hello」そのまま' },
        ],
      },
    },
    {
      id: 'ping',
      title: 'Ping / Pong で生存確認',
      hops: [
        { from: 'server', to: 'client', label: 'Ping', kind: 'control' },
        { from: 'client', to: 'server', label: 'Pong', kind: 'control' },
      ],
      body:
        'しばらく無通信だと、NATやロードバランサーが接続を勝手に切ることがあります。Pingを定期的に流し、受け取った側は同じペイロードでPongを返します。\n\nブラウザのJS APIからはPingを送れないので、アプリ側で独自のハートビートメッセージを流すことも多いです。',
      packet: {
        name: 'Pingフレーム',
        layers: ['IPv4', 'TCP', 'WebSocket'],
        fields: [
          { name: 'FIN + opcode', hex: '89', desc: 'opcode=0x9(Ping)。制御フレームは分割できない' },
          { name: 'MASK + 長さ', hex: '05', desc: '長さ5(制御フレームは125以下)' },
          { name: 'ペイロード', hex: '48 65 6C 6C 6F', desc: 'Pongでそのまま返される' },
        ],
      },
    },
    {
      id: 'close',
      title: 'Closeで終える',
      hops: [
        { from: 'client', to: 'server', label: 'Close 1000', kind: 'control' },
        { from: 'server', to: 'client', label: 'Close 1000', kind: 'control' },
        { from: 'server', to: 'client', label: 'TCP FIN', kind: 'control' },
      ],
      body:
        '終了はCloseフレームの交換から。先頭2バイトに理由コードが入ります。1000は正常終了、1001は離脱、1006は(実際には送られない)異常切断を表す値です。\n\n両方がCloseを送り合ったら、サーバーがTCPを閉じます。',
      packet: {
        name: 'Closeフレーム(クライアント)',
        layers: ['IPv4', 'TCP', 'WebSocket'],
        fields: [
          { name: 'FIN + opcode', hex: '88', desc: 'opcode=0x8(Close)' },
          { name: 'MASK + 長さ', hex: '82', desc: 'MASK=1、長さ2' },
          { name: 'マスキングキー', hex: '37 FA 21 3D' },
          { name: 'ステータス(マスク済み)', hex: '34 12', desc: '0x03E8 = 1000(正常終了)をマスクした値' },
        ],
      },
    },
  ],
  sources: [
    { label: 'RFC 6455 The WebSocket Protocol', url: 'https://www.rfc-editor.org/rfc/rfc6455' },
    { label: 'RFC 9293 Transmission Control Protocol (TCP)', url: 'https://www.rfc-editor.org/rfc/rfc9293' },
  ],
  lastVerified: '2026-11-06',
};

export default websocket;
