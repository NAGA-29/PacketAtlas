// つながり図の配置(純粋関数)。レーンを機器として置き、ホップから通信する組を線にする
import type { HopKind, Lesson } from '@/lessons/types';
import { laneLabelWidth, textWidth } from './diagram';
import { dict } from './i18n';

export const NODE_W = 150;
/** 機器の線画と、その下の名前・補足を含む占有領域 */
export const NODE_H = 156;

export interface TopoNode {
  id: string;
  x: number;
  y: number;
  /** 箱の幅(見出しが収まる幅) */
  w: number;
}

export interface TopoEdge {
  /** 並びを決めて重複をなくすため a < b(レーンの順) */
  a: string;
  b: string;
  /** この線を使う最初の手順 */
  firstStep: number;
}

export interface TopologyLayout {
  width: number;
  height: number;
  nodes: TopoNode[];
  edges: TopoEdge[];
  /** 中心に置いた機器(ハブ)。なければ undefined */
  hub?: string;
}

export const edgeKey = (x: string, y: string, order: string[]): [string, string] =>
  order.indexOf(x) <= order.indexOf(y) ? [x, y] : [y, x];

export const layoutTopology = (lesson: Pick<Lesson, 'lanes' | 'steps'>): TopologyLayout => {
  const order = lesson.lanes.map((l) => l.id);
  const edges = new Map<string, TopoEdge>();
  lesson.steps.forEach((st, si) =>
    st.hops.forEach((h) => {
      if (h.from === h.to) return;
      const [a, b] = edgeKey(h.from, h.to, order);
      const k = `${a}|${b}`;
      if (!edges.has(k)) edges.set(k, { a, b, firstStep: si });
    }),
  );
  const list = [...edges.values()];
  const degree = (id: string) => list.filter((e) => e.a === id || e.b === id).length;
  const n = order.length;
  // 線が隣り合うレーンの間にしかなければ、横一列に並べる(経路が一本道の場合)
  const isPath = list.every((e) => Math.abs(order.indexOf(e.a) - order.indexOf(e.b)) === 1);
  let width = 640;
  let nodes: TopoNode[];
  let height: number;
  let hub: string | undefined;

  const boxW = (id: string) => {
    const lane = lesson.lanes.find((l) => l.id === id);
    return Math.max(NODE_W, Math.ceil(laneLabelWidth(lane) + 24));
  };

  if (n <= 2 || isPath) {
    // 箱の幅に合わせて間隔を決める。線の長さは、その線に載る一番長いラベルが収まるようにする
    const linkFor = (x: string, y: string) => {
      let w = 0;
      lesson.steps.forEach((_, si) => {
        for (const tr of activeEdges(lesson, si).get(`${x}|${y}`) ?? []) w = Math.max(w, textWidth(trackLabel(tr), EDGE_LABEL_PX));
      });
      return Math.max(90, Math.ceil(w) + 24);
    };
    height = 340;
    nodes = [];
    let x = 20;
    order.forEach((id, i) => {
      const w = boxW(id);
      const prev = order[i - 1] ?? id;
      x += i === 0 ? w / 2 : boxW(prev) / 2 + linkFor(prev, id) + w / 2;
      nodes.push({ id, x: Math.round(x), y: height / 2, w });
    });
    const used = x + boxW(order[n - 1] ?? '') / 2 + 20;
    width = Math.max(640, Math.ceil(used));
    // 余った幅は左右に均等に配る
    const extra = (width - used) / 2;
    for (const node of nodes) node.x = Math.round(node.x + extra);
  } else {
    // 星形(1台が他の全員とつながり、他はその1台としか話さない)なら中心に置く(DNS のリゾルバーなど)
    const candidates = order.filter((id) => degree(id) === n - 1 && order.every((o) => o === id || degree(o) === 1));
    hub = n >= 4 && candidates.length === 1 ? candidates[0] : undefined;
    const ring = hub ? order.filter((id) => id !== hub) : order;
    width = 800;
    const cx = width / 2;
    const rx = 300;
    const ry = hub ? 205 : ring.length <= 3 ? 135 : 170;
    height = 2 * ry + NODE_H + 100;
    const cy = height / 2;
    // 3つなら上に2つ・下に1つ、4つなら四隅
    const start = ring.length === 3 ? -Math.PI / 2 - Math.PI / 3 : -Math.PI / 2 - Math.PI / ring.length;
    nodes = ring.map((id, i) => {
      const ang = start + (2 * Math.PI * i) / ring.length;
      return { id, x: Math.round(cx + rx * Math.cos(ang)), y: Math.round(cy + ry * Math.sin(ang)), w: 0 };
    });
    if (hub) nodes.push({ id: hub, x: cx, y: cy, w: 0 });
    nodes.sort((p, q) => order.indexOf(p.id) - order.indexOf(q.id));
  }
  for (const node of nodes) node.w = boxW(node.id);
  // 箱が図からはみ出さないよう、必要なら左右を広げて全体をずらす
  const minX = Math.min(...nodes.map((p) => p.x - p.w / 2));
  const maxX = Math.max(...nodes.map((p) => p.x + p.w / 2));
  const shift = minX < 10 ? 10 - minX : 0;
  for (const node of nodes) node.x += shift;
  width = Math.max(width + shift, maxX + shift + 10);
  return { width, height, nodes, edges: list, hub };
};

/** 1本の線の上を、ある種類のパケットが通る様子(種類ごとに平行線を1本引く) */
export interface EdgeTrack {
  kind: HopKind;
  /** a → b の向きに通るか */
  forward: boolean;
  /** b → a の向きに通るか */
  backward: boolean;
  /** その種類のホップのラベル(出てきた順)。同じ文字のものはまとめて回数を数える */
  labels: { text: string; total: number; lost: number }[];
  /** その種類のホップが全部消えるか / 一部でも消えるか */
  lostAll: boolean;
  lostAny: boolean;
  /** 線に垂直な向きへのずらし量(px)。種類が1つなら 0 */
  offset: number;
}

/** トラックのラベル:同じ名前は「×回数」、消失は「(消失)」「(2つ消失)」 */
export const trackLabel = (tr: Pick<EdgeTrack, 'labels'>, t = dict('ja')): string =>
  tr.labels
    .map((l) => l.text + (l.total > 1 ? ` ×${l.total}` : '') + (l.lost === 0 ? '' : l.total > 1 ? t.lostCount(l.lost) : t.lost))
    .join(' / ');

/** ラベルの文字の大きさ(px)。TopologyView の CSS と合わせる */
export const EDGE_LABEL_PX = 12;

/** 平行線どうしの間隔 */
export const TRACK_GAP = 7;

/** ある手順で、線ごとに通るパケットを種類別にまとめる */
export const activeEdges = (lesson: Pick<Lesson, 'lanes' | 'steps'>, step: number): Map<string, EdgeTrack[]> => {
  const order = lesson.lanes.map((l) => l.id);
  const out = new Map<string, EdgeTrack[]>();
  const counts = new Map<EdgeTrack, { total: number; lost: number }>();
  for (const h of lesson.steps[step]?.hops ?? []) {
    if (h.from === h.to) continue;
    const [a, b] = edgeKey(h.from, h.to, order);
    const k = `${a}|${b}`;
    const tracks = out.get(k) ?? [];
    let tr = tracks.find((x) => x.kind === h.kind);
    if (!tr) {
      tr = { kind: h.kind, forward: false, backward: false, labels: [], lostAll: false, lostAny: false, offset: 0 };
      tracks.push(tr);
      counts.set(tr, { total: 0, lost: 0 });
    }
    if (h.from === a) tr.forward = true;
    else tr.backward = true;
    let lab = tr.labels.find((l) => l.text === h.label);
    if (!lab) {
      lab = { text: h.label, total: 0, lost: 0 };
      tr.labels.push(lab);
    }
    lab.total += 1;
    if (h.lost) lab.lost += 1;
    const c = counts.get(tr)!;
    c.total += 1;
    if (h.lost) c.lost += 1;
    out.set(k, tracks);
  }
  for (const tracks of out.values()) {
    tracks.forEach((tr, i) => {
      const c = counts.get(tr)!;
      tr.lostAny = c.lost > 0;
      tr.lostAll = c.lost === c.total;
      tr.offset = (i - (tracks.length - 1) / 2) * TRACK_GAP;
    });
  }
  return out;
};

/** 線分を、線に垂直な向き(左手側)へ d だけずらす */
export const offsetSegment = (x1: number, y1: number, x2: number, y2: number, d: number): [number, number, number, number] => {
  if (d === 0) return [x1, y1, x2, y2];
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  return [x1 + nx * d, y1 + ny * d, x2 + nx * d, y2 + ny * d];
};

/** 線分を、両端の箱の縁で切る */
export const clipToBoxes = (p: TopoNode, q: TopoNode, pad = 6): [number, number, number, number] => {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const t = (w: number) => Math.min(dx === 0 ? Infinity : (w / 2 + pad) / Math.abs(dx), dy === 0 ? Infinity : (NODE_H / 2 + pad) / Math.abs(dy));
  const tp = t(p.w);
  const tq = t(q.w);
  return [p.x + dx * tp, p.y + dy * tp, q.x - dx * tq, q.y - dy * tq];
};

/** 線のラベルの位置:線の中点から、線に垂直な向きへ少しずらす */
export const labelPosition = (x1: number, y1: number, x2: number, y2: number, offset = 10): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  // 上側(画面の y が小さい側)の法線を選ぶ
  let nx = -(y2 - y1) / len;
  let ny = (x2 - x1) / len;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const anchor = Math.abs(nx) < 0.35 ? 'middle' : nx > 0 ? 'start' : 'end';
  return { x: mx + nx * offset, y: my + ny * offset + (anchor === 'middle' ? -2 : 4), anchor };
};
