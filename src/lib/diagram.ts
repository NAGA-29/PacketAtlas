// シーケンス図の座標計算(描画とは切り離した純粋関数)
import type { Hop, Lesson } from '@/lessons/types';

export const ROW_H = 38;
export const STEP_GAP = 14;
/** レーン見出し:アイコン(0〜28)、名前、補足の下から線が始まる */
export const ICON_TOP = 4;
export const LANE_TOP = 76;
export const TOP = 102;

export interface HopRow {
  step: number;
  index: number;
  y: number;
  hop: Hop;
  /** 矢印の始点・終点(手元の処理なら同じ値) */
  x1: number;
  x2: number;
  /** 消失する場合、×を描く位置 */
  lostAt?: number;
}

export interface StepBox {
  y0: number;
  y1: number;
}

export interface DiagramLayout {
  width: number;
  height: number;
  laneX: Record<string, number>;
  rows: HopRow[];
  steps: StepBox[];
}

export const laneGap = (n: number): number => (n <= 2 ? 280 : n === 3 ? 200 : n === 4 ? 160 : 136);

export const layoutDiagram = (lesson: Pick<Lesson, 'lanes' | 'steps'>): DiagramLayout => {
  const n = lesson.lanes.length;
  const gap = laneGap(n);
  // 端のレーンにある「手元の処理」の箱がはみ出さないよう余白を広げる
  const halfAt = (laneId: string | undefined) =>
    Math.max(0, ...lesson.steps.flatMap((st) => st.hops.filter((h) => h.from === h.to && h.from === laneId).map((h) => selfBoxWidth(h.label) / 2)));
  const first = lesson.lanes[0];
  const last = lesson.lanes[n - 1];
  const padL = Math.max(64, 40 + halfAt(first?.id), 6 + laneLabelWidth(first) / 2);
  const padR = Math.max(56, 10 + halfAt(last?.id), 6 + laneLabelWidth(last) / 2);
  const width = padL + padR + gap * (n - 1);
  const laneX: Record<string, number> = {};
  lesson.lanes.forEach((l, i) => {
    laneX[l.id] = padL + i * gap;
  });
  const rows: HopRow[] = [];
  const steps: StepBox[] = [];
  let y = TOP;
  lesson.steps.forEach((st, si) => {
    const y0 = y;
    st.hops.forEach((hop, hi) => {
      const xf = laneX[hop.from] ?? 0;
      const xt = laneX[hop.to] ?? 0;
      if (hop.from === hop.to) rows.push({ step: si, index: hi, y, hop, x1: xf, x2: xf });
      else {
        const dir = Math.sign(xt - xf);
        const x1 = xf + dir * 4;
        const x2 = xt - dir * 4;
        rows.push({ step: si, index: hi, y, hop, x1, x2, lostAt: hop.lost ? (x1 + x2) / 2 : undefined });
      }
      y += ROW_H;
    });
    steps.push({ y0, y1: y - ROW_H });
    y += STEP_GAP;
  });
  return { width, height: y + 10, laneX, rows, steps };
};

/** 文字幅の目安:ASCII は約0.6em、それ以外は1em */
export const textWidth = (s: string, px: number): number =>
  Array.from(s).reduce((a, c) => a + (c.charCodeAt(0) < 0x80 ? 0.6 : 1) * px, 0);

/** レーン見出し(名前14px・補足11px)の幅 */
export const laneLabelWidth = (lane?: { name: string; sub?: string }): number =>
  lane ? Math.max(textWidth(lane.name, 14), textWidth(lane.sub ?? '', 11)) : 0;

/** 手元の処理の箱の幅(全角を11px前後とみなす) */
export const selfBoxWidth = (label: string): number => label.length * 11 + 20;
