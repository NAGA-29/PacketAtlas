import type { CompareTable, Lesson, Part, PartNo, PlannedLesson } from './types';
import websocket from './ja/websocket';
import webrtc from './ja/webrtc';
import game from './ja/game';
import webtransport from './ja/webtransport';
import compareRealtime from './ja/compare-realtime';

export const PARTS: Part[] = [
  { no: 1, slug: 'link', title: 'つながる', summary: '隣の機器に届け、住所をもらう' },
  { no: 2, slug: 'transport', title: '運ぶ', summary: 'アプリのデータを相手のポートまで運ぶ' },
  { no: 3, slug: 'naming-security', title: '名前と安全', summary: '名前を引き、通信を暗号化する' },
  { no: 4, slug: 'web', title: 'Web', summary: 'HTTP の世代ごとの違いを見る' },
  { no: 5, slug: 'mail-remote', title: 'メールとリモート', summary: 'テキストで話す古典的なプロトコル' },
  { no: 6, slug: 'realtime', title: 'リアルタイム', summary: '遅延を削って双方向に送り続ける' },
];

/** 書き上がったレッスン(日本語) */
export const LESSONS: Lesson[] = [websocket, webrtc, game, webtransport];

/** 収録予定で、まだ書かれていないレッスン */
export const PLANNED: PlannedLesson[] = [
  { id: 'ethernet-arp', part: 1, order: 1, title: 'Ethernet と ARP', tagline: 'IPアドレスからMACアドレスを引き、隣へ届ける' },
  { id: 'ip', part: 1, order: 2, title: 'IP(v4 / v6)', tagline: 'TTLを減らしながらルーターを渡っていく' },
  { id: 'icmp', part: 1, order: 3, title: 'ICMP', tagline: 'ping と traceroute の正体' },
  { id: 'dhcp', part: 1, order: 4, title: 'DHCP', tagline: 'つないだ瞬間にアドレスをもらう4手順' },
  { id: 'udp', part: 2, order: 1, title: 'UDP', tagline: '8バイトのヘッダーだけで送りっぱなし' },
  { id: 'tcp', part: 2, order: 2, title: 'TCP', tagline: '握手し、数え、落ちたら送り直す' },
  { id: 'dns', part: 3, order: 1, title: 'DNS', tagline: 'ルートから順に名前をたどる' },
  { id: 'tls13', part: 3, order: 2, title: 'TLS 1.3', tagline: '1往復で鍵を共有し、相手を確かめる' },
  { id: 'http11', part: 4, order: 1, title: 'HTTP/1.1', tagline: 'テキストで頼み、テキストで返す' },
  { id: 'https', part: 4, order: 2, title: 'HTTPS(通し)', tagline: 'DNS→TCP→TLS→HTTP をひと続きで見る' },
  { id: 'http2', part: 4, order: 3, title: 'HTTP/2', tagline: '1本の接続にストリームを多重化する' },
  { id: 'http3', part: 4, order: 4, title: 'HTTP/3 と QUIC', tagline: 'UDPの上でTCPの弱点を解く' },
  { id: 'smtp', part: 5, order: 1, title: 'SMTP', tagline: 'メールをサーバーからサーバーへ渡す' },
  { id: 'pop3', part: 5, order: 2, title: 'POP3', tagline: 'メールを受け取って消す' },
  { id: 'imap', part: 5, order: 3, title: 'IMAP', tagline: 'サーバー上のメールを操作する' },
  { id: 'ssh', part: 5, order: 4, title: 'SSH', tagline: '鍵を交換し、暗号化された端末を開く' },
  { id: 'ftp', part: 5, order: 5, title: 'FTP', tagline: '制御とデータの2本の接続' },
];

/** 部ごとの比較ページ */
export const COMPARES: CompareTable[] = [compareRealtime];

/** 比較ページがある部 */
export const COMPARE_PARTS: PartNo[] = COMPARES.map((c) => c.part);

export const getCompare = (part: PartNo): CompareTable | undefined => COMPARES.find((c) => c.part === part);

const byOrder = <T extends { part: number; order: number }>(a: T, b: T) => a.part - b.part || a.order - b.order;

export const orderedLessons = (): Lesson[] => [...LESSONS].sort(byOrder);

export const getLesson = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

export const getPart = (no: PartNo): Part => {
  const p = PARTS.find((x) => x.no === no);
  if (!p) throw new Error(`unknown part ${no}`);
  return p;
};

export const getPartBySlug = (slug: string): Part | undefined => PARTS.find((p) => p.slug === slug);

export const lessonsInPart = (no: PartNo): Lesson[] => orderedLessons().filter((l) => l.part === no);

/** 一覧用:書き上がったものと予定を部ごとにまとめる */
export const catalog = (no: PartNo): (Lesson | PlannedLesson)[] => {
  const done = new Set(LESSONS.map((l) => l.id));
  return [...LESSONS, ...PLANNED.filter((p) => !done.has(p.id))].filter((l) => l.part === no).sort(byOrder);
};

export const isLesson = (l: Lesson | PlannedLesson): l is Lesson => 'steps' in l;

export interface NavLink {
  href: string;
  label: string;
}

/** 前後のレッスン。部の最後は比較ページへつなぐ */
export const lessonNeighbors = (id: string, locale: string): { prev?: NavLink; next?: NavLink } => {
  const all = orderedLessons();
  const i = all.findIndex((l) => l.id === id);
  const cur = all[i];
  if (!cur) return {};
  const before = all[i - 1];
  const after = all[i + 1];
  const prev = before ? { href: `/${locale}/${before.id}/`, label: before.title } : undefined;
  let next: NavLink | undefined;
  if (after && after.part === cur.part) next = { href: `/${locale}/${after.id}/`, label: after.title };
  else if (COMPARE_PARTS.includes(cur.part))
    next = { href: `/${locale}/compare/${getPart(cur.part).slug}/`, label: `第${cur.part}部の比較` };
  else if (after) next = { href: `/${locale}/${after.id}/`, label: after.title };
  return { prev, next };
};
