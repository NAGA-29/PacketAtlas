export const LOCALES = ['ja'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';

export const isLocale = (s: string): s is Locale => (LOCALES as readonly string[]).includes(s);

const ja = {
  siteName: 'Packet Atlas',
  siteTagline: 'インターネットのプロトコルを、1パケットずつ',
  part: (n: number) => `第${n}部`,
  step: (i: number, n: number) => `手順 ${i} / ${n}`,
  prev: '前へ',
  next: '次へ',
  play: '自動再生',
  pause: '一時停止',
  speed: '速度',
  legend: { control: '接続制御', signal: 'シグナリング', media: 'メディア・状態', data: 'データ' },
  legendHint: '図をクリックでその手順へ',
  lost: '(消失)',
  noPacket: 'パケットなし',
  noPacketBody: 'この手順は手元の処理だけで、ネットワークには何も流れません。',
  bytesShown: (n: number) => `${n} バイト表示`,
  fictional: '架空フォーマット:この章のバイナリは解説用に作ったもので、実在するプロトコルではありません。',
  decrypted: '実際のパケットでは暗号化されている部分を、復号後の姿で示しています。',
  bitsToggle: 'ビットを見る',
  bitsHide: 'ビットを閉じる',
  layers: 'カプセル化',
  sources: '一次資料',
  lastVerified: (d: string) => `一次資料との照合: ${d}`,
  planned: '準備中',
  compare: '比較',
  comparePage: (n: number) => `第${n}部の比較`,
  about: '資料とライセンス',
  prevLesson: '前のレッスン',
  nextLesson: '次のレッスン',
  partsMenu: '部を選ぶ',
  lessonsNav: 'レッスン',
  diagram: 'シーケンス図',
  diagramOf: (t: string) => `${t}のシーケンス図`,
  packetPanel: 'パケットの中身',
  theme: { system: '自動', light: 'ライト', dark: 'ダーク', label: 'テーマ' },
  skip: '本文へ移動',
  overview: { title: 'プロトコルの概要', layer: '層', transport: 'トランスポート', ports: '既定のポート', format: 'データ形式', specs: '規定' },
  view: { label: '図の表示', sequence: 'シーケンス', topology: 'つながり' },
  topologyOf: (t: string) => `${t}のつながり図`,
  topologyHint: '線は通信する組。今の手順で使う線を色と矢印で示す',
  top: 'トップ',
};

export type Dict = typeof ja;

const DICTS: Record<Locale, Dict> = { ja };

export const dict = (locale: Locale): Dict => DICTS[locale];
