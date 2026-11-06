import type { Field, Lesson, Packet } from '../types';

/** 架空フォーマット共通のヘッダー(src/lib/codecs/game.ts と同じ並び) */
const gameHeader = (seq: string, ack: string, ackBits: string, type: string, typeDesc: string, ackDesc?: string, ackBitsDesc?: string): Field[] => [
  { name: 'プロトコルID', hex: '47 41 4D 45', desc: '「GAME」。無関係なUDPパケットをここで弾く' },
  { name: 'シーケンス', hex: seq, desc: 'このパケットの通し番号' },
  { name: 'ack', hex: ack, desc: ackDesc ?? '相手から最後に受け取ったパケット番号' },
  { name: 'ack bits', hex: ackBits, desc: ackBitsDesc ?? 'ackより前の32個を受け取れたか(1=受信)' },
  { name: '種別', hex: type, desc: typeDesc },
];

const GAME_NOTE =
  'Glenn Fiedler の「Networking for Game Programmers」系の設計を参考にしています。実際のゲームは独自形式を使います。';

const fictional = (p: Omit<Packet, 'fictional' | 'note' | 'layers'>): Packet => ({
  ...p,
  layers: ['IPv4', 'UDP', 'GAME'],
  fictional: true,
  note: GAME_NOTE,
});

const game: Lesson = {
  id: 'game',
  part: 6,
  order: 3,
  title: 'ゲームのネットコード',
  tagline: 'UDPの上に自前の信頼性を足し、最新の状態を最速で届ける',
  lead:
    '**対戦ゲームはUDPの上に自前のプロトコルを作るのが一般的です。**「全部届ける」より「最新の状態を最速で届ける」が大事なので、古い状態は捨て、必要なものだけ信頼性を足します。サーバー権威型で、60Hzのシミュレーションを想定しています。',
  lanes: [
    { id: 'a', name: 'Client A', sub: '自分' },
    { id: 'server', name: 'サーバー', sub: '権威を持つ' },
    { id: 'b', name: 'Client B', sub: '対戦相手' },
  ],
  steps: [
    {
      id: 'connect',
      title: '接続とチャレンジ',
      hops: [
        { from: 'a', to: 'server', label: 'CONNECT', kind: 'control' },
        { from: 'server', to: 'a', label: 'CHALLENGE', kind: 'control' },
        { from: 'a', to: 'server', label: 'RESPONSE', kind: 'control' },
        { from: 'server', to: 'a', label: 'ACCEPT', kind: 'control' },
      ],
      body:
        'UDPには接続の概念がないので、自分で作ります。サーバーはいきなり席を確保せず、まずチャレンジを返して「本当にそのアドレスで受信できるか」を確かめます。送信元を偽装した大量のCONNECTでサーバーを埋められないようにするためです。\n\nCONNECTはわざと大きくパディングします。応答より小さいリクエストを許すと、増幅攻撃の踏み台にされるからです。',
      packet: fictional({
        name: 'CONNECT',
        fields: [
          { name: 'プロトコルID', hex: '47 41 4D 45', desc: '「GAME」' },
          { name: '種別', hex: '10', desc: 'CONNECT' },
          { name: 'クライアントソルト', hex: '8A 3F 91 0C 55 E2 7B 14', desc: '乱数(例)。以降の識別に使う' },
          { name: 'パディング', hex: '00 00 … 00', desc: '応答より大きくして増幅攻撃に使わせない' },
        ],
      }),
    },
    {
      id: 'input',
      title: '入力を送る(冗長つき)',
      hops: [{ from: 'a', to: 'server', label: 'INPUT t=8001', kind: 'data' }],
      body:
        'クライアントが送るのは位置ではなく**入力**です。位置を送るとチートし放題になるからです。\n\n毎パケットに直近3ティック分の入力を重ねて入れます。1つ落ちても次のパケットで補えるので、再送を待つ必要がありません。数バイトの冗長で遅延を消す、ゲームらしい割り切りです。',
      packet: fictional({
        name: 'INPUT',
        fields: [
          ...gameHeader('04 12', '00 C8', 'FF FF FF FF', '01', 'INPUT'),
          { name: 'ティック', hex: '00 00 1F 41', desc: '8001' },
          { name: '入力数', hex: '03', desc: '直近3ティック分' },
          { name: '入力 8001', hex: '09 40 00', desc: 'ボタン(前進+ジャンプ) + 視点yaw(±180°を16bitに量子化)' },
          { name: '入力 8000', hex: '01 3F F0', desc: '前進のみ' },
          { name: '入力 7999', hex: '01 3F E0', desc: '前進のみ' },
        ],
      }),
    },
    {
      id: 'prediction',
      title: 'クライアント側予測',
      hops: [{ from: 'a', to: 'a', label: '予測 t=8001', kind: 'media' }],
      body:
        'サーバーの返事を待ってからキャラを動かすと、往復分(例えば80ms)遅れて動いて気持ち悪くなります。そこで自分の入力はすぐ手元でもシミュレーションして画面に反映します。\n\n送った入力はバッファに残しておきます。あとでサーバーの答えと食い違ったときに、やり直しに使うためです。',
      packet: {
        name: '手元の入力バッファ',
        note: 'ネットワークには流れない、クライアント内部の状態です。',
        fields: [
          { name: 't=7999', text: '前進 → x=360.8', lineBreak: true, desc: 'サーバー未確認' },
          { name: 't=8000', text: '前進 → x=360.9', lineBreak: true, desc: 'サーバー未確認' },
          { name: 't=8001', text: '前進+ジャンプ → x=361.0', lineBreak: true, desc: 'サーバー未確認' },
        ],
      },
    },
    {
      id: 'snapshot',
      title: 'スナップショットが届く',
      hops: [
        { from: 'server', to: 'a', label: 'SNAPSHOT t=8004', kind: 'media' },
        { from: 'server', to: 'b', label: 'SNAPSHOT t=8004', kind: 'media' },
      ],
      body:
        'サーバーは20Hzほどで世界の状態を配ります。全部を毎回送ると重いので、2つの工夫をします。\n\n**量子化**:位置を32bit浮動小数ではなく1/64m単位の16bit整数にする。**差分圧縮**:相手がackした最新のスナップショット(ベースライン)から変わった項目だけを送る。どちらも数分の1に縮みます。',
      packet: fictional({
        name: 'SNAPSHOT(Aあて)',
        fields: [
          ...gameHeader('00 D1', '04 12', 'FF FF FF FF', '02', 'SNAPSHOT'),
          { name: 'サーバーティック', hex: '00 00 1F 44', desc: '8004' },
          { name: 'ベースライン', hex: '00 00 1F 3E', desc: '差分の基準 7998(Aがackした最新)' },
          { name: '処理済み入力', hex: '00 00 1F 42', desc: 'Aの入力を8002まで適用した' },
          { name: 'エンティティ数', hex: '02', desc: '変化したものだけ' },
          { name: 'ID(1件目)', hex: '00 07', desc: 'プレイヤーB' },
          {
            name: '変更マスク',
            hex: '03',
            desc: 'x と y が変化',
            bits: [
              { name: '予約', bits: 5 },
              { name: 'rot', bits: 1, desc: '回転' },
              { name: 'y', bits: 1 },
              { name: 'x', bits: 1 },
            ],
          },
          { name: 'x', hex: '5A 40', desc: '23104 ÷ 64 = 361.0 m' },
          { name: 'y', hex: '12 80', desc: '4736 ÷ 64 = 74.0 m' },
          { name: 'ID(2件目)', hex: '00 03', desc: '樽' },
          { name: '変更マスク', hex: '04', desc: '回転だけ変化' },
          { name: '回転', hex: '7F', desc: '8bitに量子化' },
        ],
      }),
    },
    {
      id: 'loss',
      title: 'パケットが落ちても再送しない',
      hops: [
        { from: 'server', to: 'a', label: 'SNAPSHOT t=8007', kind: 'media', lost: true },
        { from: 'server', to: 'a', label: 'SNAPSHOT t=8010', kind: 'media' },
        { from: 'a', to: 'server', label: 'INPUT (ack)', kind: 'data' },
      ],
      body:
        't=8007のスナップショットが消えました。でも再送はしません。t=8010が届けばt=8007はもう古くて要らないからです。\n\nAの次のパケットのack bitsで、サーバーは「#210が届いていない」と知ります。次の差分はAが確実に持っているt=8004を基準に作り直します。TCPだとこの1つのロスで後続が全部止まりますが、UDPなら止まりません。',
      packet: fictional({
        name: 'Aの次のパケットのヘッダー',
        fields: gameHeader(
          '04 1C',
          '00 D3',
          'FF FF FF FE',
          '01',
          'INPUT',
          '受け取った最新:#211(t=8010)',
          'bit0が0 → #210(t=8007)が欠落',
        ),
      }),
    },
    {
      id: 'reconcile',
      title: 'サーバーの答えと突き合わせる',
      hops: [{ from: 'a', to: 'a', label: '巻き戻し+再適用', kind: 'media' }],
      body:
        'スナップショットには「Aの入力をどこまで処理したか」が入っています。その時点のサーバーの位置に一度戻し、まだ確認されていない入力をもう一度シミュレーションし直します(リコンシリエーション)。\n\n予測が合っていれば何も起きません。ずれていた場合も、一気にワープさせず数フレームかけて滑らかに寄せます。',
      packet: {
        name: 'リコンシリエーションの計算',
        note: 'ネットワークには流れない、クライアント内部の計算です。',
        fields: [
          { name: 'サーバー確定', text: 'x=361.0(入力8002まで適用済み)', lineBreak: true },
          { name: '手元の予測', text: 'x=361.4', lineBreak: true, desc: '0.4mずれていた' },
          { name: '巻き戻し', text: '確定位置 x=361.0 に戻す', lineBreak: true },
          { name: '再適用', text: '入力 8003, 8004, 8005 を再シミュレーション', lineBreak: true, desc: '未確認の入力だけ' },
          { name: '結果', text: 'x=361.1', lineBreak: true, desc: '描画は数フレームかけて補正' },
        ],
      },
    },
    {
      id: 'interpolation',
      title: '相手は少し過去を描く(補間)',
      hops: [{ from: 'b', to: 'b', label: '描画 t−100ms', kind: 'media' }],
      body:
        '他のプレイヤーの入力は予測できません。そこで相手のキャラは約100ms(スナップショット2つ分)遅らせて、届いた2つのスナップショットの間を補間して描きます。\n\n常に「前」と「次」の両方が手元にあるので、パケットが1つ落ちてもカクつきません。その代わり、画面の相手は少しだけ過去にいます。',
      packet: {
        name: '補間の計算(Bの画面のプレイヤーA)',
        note: 'ネットワークには流れない、クライアント内部の計算です。',
        fields: [
          { name: '現在の時刻', text: 't=8012', lineBreak: true },
          { name: '描画する時刻', text: 't=8006', lineBreak: true, desc: '6ティック = 100ms 前' },
          { name: '前のスナップショット', text: 't=8004 x=361.0', lineBreak: true },
          { name: '次のスナップショット', text: 't=8010 x=362.5', lineBreak: true },
          { name: '補間結果', text: 'x=361.5', lineBreak: true, desc: '8004〜8010 の 1/3 地点を線形補間' },
        ],
      },
    },
    {
      id: 'lag-compensation',
      title: '撃った瞬間まで巻き戻して判定(ラグ補償)',
      hops: [
        { from: 'b', to: 'server', label: 'FIRE', kind: 'data' },
        { from: 'server', to: 'server', label: '当たり判定を巻き戻し', kind: 'media' },
        { from: 'server', to: 'b', label: 'HIT', kind: 'data' },
        { from: 'server', to: 'a', label: 'DAMAGE', kind: 'data' },
      ],
      body:
        'Bの画面のAは100ms過去にいます。そのまま現在のAに当たり判定をすると、ちゃんと狙ったのに外れます。サーバーはFIREに入っている描画ティックまで全員の当たり判定を巻き戻して判定します。\n\n代償として、撃たれた側は「壁に隠れたのに当たった」と感じることがあります。巻き戻せる時間に上限を設けるのが普通です。',
      packet: fictional({
        name: 'FIRE',
        fields: [
          ...gameHeader('02 9A', '00 D5', 'FF FF FF FF', '03', 'FIRE'),
          { name: '発射ティック', hex: '00 00 1F 4C', desc: '8012' },
          { name: '描画ティック', hex: '00 00 1F 46', desc: '8006。Bが見ていた過去の世界' },
          { name: '射撃方向', hex: '3A 10 F8 02', desc: 'yaw / pitch 各16bit' },
        ],
      }),
    },
    {
      id: 'reliable',
      title: '必要なものだけ信頼性を足す',
      hops: [
        { from: 'a', to: 'server', label: 'CHAT #5', kind: 'data', lost: true },
        { from: 'a', to: 'server', label: 'INPUT + CHAT #5', kind: 'data' },
        { from: 'server', to: 'a', label: 'SNAPSHOT (ack)', kind: 'media' },
      ],
      body:
        'チャットやアイテム取得のように「必ず届けたい」ものもあります。そうしたメッセージは、ackで受信が確認されるまで毎回の送信パケットに相乗りさせます。追加のパケットを増やさずに済みます。\n\n大事なのは、チャットが1つ落ちても位置の同期は止まらないこと。TCPでは1本の流れの中で全部が待たされる(ヘッドオブラインブロッキング)ので、ここが自作する一番の理由です。',
      packet: fictional({
        name: '信頼メッセージ部分',
        fields: [
          { name: '種別', hex: '20', desc: 'RELIABLE' },
          { name: 'メッセージID', hex: '00 05', desc: '再送しても同じID。受信側で重複を捨てる' },
          { name: '長さ', hex: '02' },
          { name: '本文', hex: '67 67', desc: '「gg」' },
        ],
      }),
    },
  ],
  sources: [
    { label: 'RFC 768 User Datagram Protocol', url: 'https://www.rfc-editor.org/rfc/rfc768' },
    { label: 'Glenn Fiedler「Game Networking」', url: 'https://gafferongames.com/categories/game-networking/' },
    { label: 'Valve「Source Multiplayer Networking」', url: 'https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking' },
  ],
  lastVerified: '2026-11-06',
};

export default game;
