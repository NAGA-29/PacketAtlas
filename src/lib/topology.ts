// つながり図の配置(純粋関数)。レーンを機器として置き、ホップから通信する組を線にする
import type { HopKind, Lesson } from '@/lessons/types';
import { laneLabelWidth } from './diagram';

export const NODE_W = 150;
export const NODE_H = 54;

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

  const boxW = (id: string) => Math.max(NODE_W, Math.ceil(laneLabelWidth(lesson.lanes.find((l) => l.id === id)) + 24));

  if (n <= 2 || isPath) {
    // 箱の幅に合わせて間隔を決める(線の長さを最低でも LINK 確保する)
    const LINK = 90;
    height = 170;
    nodes = [];
    let x = 20;
    order.forEach((id, i) => {
      const w = boxW(id);
      x += i === 0 ? w / 2 : boxW(order[i - 1] ?? id) / 2 + LINK + w / 2;
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
    const cx = width / 2;
    const rx = hub ? 250 : 230;
    const ry = hub ? 150 : ring.length <= 3 ? 85 : 110;
    height = 2 * ry + NODE_H + 60;
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

/** ある手順で、線ごとに使われる向きと種類 */
export const activeEdges = (lesson: Pick<Lesson, 'lanes' | 'steps'>, step: number): Map<string, { forward: boolean; backward: boolean; kind: HopKind; lost: boolean }> => {
  const order = lesson.lanes.map((l) => l.id);
  const out = new Map<string, { forward: boolean; backward: boolean; kind: HopKind; lost: boolean }>();
  for (const h of lesson.steps[step]?.hops ?? []) {
    if (h.from === h.to) continue;
    const [a, b] = edgeKey(h.from, h.to, order);
    const k = `${a}|${b}`;
    const cur = out.get(k) ?? { forward: false, backward: false, kind: h.kind, lost: false };
    if (h.from === a) cur.forward = true;
    else cur.backward = true;
    if (h.lost) cur.lost = true;
    out.set(k, cur);
  }
  return out;
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
