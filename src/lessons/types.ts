// レッスンのデータモデル(docs/design.md「データモデル」)
export type HopKind = 'control' | 'signal' | 'media' | 'data';
export type PartNo = 1 | 2 | 3 | 4 | 5 | 6;

export interface Lane {
  /** 'client', 'server', 'stun' など。レッスン内で一意 */
  id: string;
  /** 表示名 */
  name: string;
  /** 補足(例: 'ws://example.com/chat') */
  sub?: string;
}

export interface Hop {
  /** Lane.id */
  from: string;
  /** Lane.id。from と同じなら「手元の処理」として箱で描く */
  to: string;
  /** 矢印の上の短い文字(全角12文字程度まで) */
  label: string;
  kind: HopKind;
  /** 途中で消えるパケット */
  lost?: boolean;
}

export interface BitField {
  name: string;
  /** 幅(合計がそのバイト数×8になること) */
  bits: number;
  desc?: string;
}

export interface Field {
  name: string;
  /** '81 85' のように2桁ずつ空白区切り。省略は '…' */
  hex?: string;
  /** HTTP行やSDP行などテキストのフィールド */
  text?: string;
  /** text の後で改行して表示 */
  lineBreak?: boolean;
  desc?: string;
  /** フラグなど1バイト内の分解(クリックで展開) */
  bits?: BitField[];
}

export interface Packet {
  /** 'WebSocketフレーム' */
  name: string;
  /** カプセル化の外側から ['IPv4', 'UDP', 'STUN'] */
  layers?: string[];
  fields: Field[];
  note?: string;
  /** 架空フォーマットなら true(画面に明示) */
  fictional?: boolean;
  /** 実際は暗号化されている部分を復号後の姿で見せる場合 */
  view?: 'decrypted';
}

export interface Step {
  /** URLのハッシュに使う(例: 'upgrade') */
  id: string;
  title: string;
  hops: Hop[];
  /** 2〜4文の短いMarkdown。空行で段落を分ける。**太字** と `code` が使える */
  body: string;
  /** なければ「パケットなし」と表示 */
  packet?: Packet;
}

export interface Source {
  label: string;
  url: string;
}

export interface Lesson {
  /** 'websocket' */
  id: string;
  part: PartNo;
  order: number;
  title: string;
  /** 一覧に出す1行 */
  tagline: string;
  /** レッスン冒頭の2〜3文(Markdown) */
  lead: string;
  lanes: Lane[];
  steps: Step[];
  /** RFCなど一次資料 */
  sources: Source[];
  /** 'YYYY-MM-DD'。内容を一次資料と突き合わせた日 */
  lastVerified: string;
}

/** まだ書かれていないレッスン(一覧に「準備中」として出す) */
export interface PlannedLesson {
  id: string;
  part: PartNo;
  order: number;
  title: string;
  tagline: string;
}

export interface Part {
  no: PartNo;
  slug: string;
  title: string;
  summary: string;
}

/** 部ごとの比較ページ */
export interface CompareTable {
  part: PartNo;
  title: string;
  lead: string;
  /** 比べる観点(行) */
  aspects: { id: string; label: string }[];
  /** 比べる方式(列)。lessonId があればそのレッスンへリンクする */
  columns: { name: string; lessonId?: string; cells: Record<string, string> }[];
  notes?: string[];
  lastVerified: string;
}
