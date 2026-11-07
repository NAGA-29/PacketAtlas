'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { HopKind, Lesson } from '@/lessons/types';
import { activeEdges, clipToBoxes, edgeKey, trackLabel, labelPosition, layoutTopology, NODE_H, offsetSegment, TRACK_GAP } from '@/lib/topology';
import { deviceIcon } from '@/lib/device';
import { dict, type Locale } from '@/lib/i18n';
import { KIND_COLOR } from '../SequenceDiagram/SequenceDiagram';
import { TopologyDevice } from './TopologyDevice';
import styles from './TopologyView.module.css';

interface Props {
  lesson: Pick<Lesson, 'id' | 'title' | 'lanes' | 'steps'>;
  locale: Locale;
  current: number;
  speed: number;
  reducedMotion: boolean;
  onSelect?: (step: number) => void;
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** 大きな機器の線画と通信経路。現在の通信を矢印と移動するパケットで示す */
export function TopologyView({ lesson, locale, current, speed, reducedMotion, onSelect }: Props) {
  const t = dict(locale);
  const layout = useMemo(() => layoutTopology(lesson), [lesson]);
  const active = useMemo(() => activeEdges(lesson, current), [lesson, current]);
  const dotRef = useRef<SVGCircleElement>(null);
  const step = lesson.steps[current];
  const selfHops = (step?.hops ?? []).filter((h) => h.from === h.to);
  const involved = new Set((step?.hops ?? []).flatMap((h) => [h.from, h.to]));
  const node = (id: string) => layout.nodes.find((n) => n.id === id);
  const kinds = Object.keys(KIND_COLOR) as HopKind[];

  // 今の手順のホップを順に、点が線に沿って動く(消失するものは途中で止まる)
  useEffect(() => {
    const dot = dotRef.current;
    if (!dot || reducedMotion) return;
    const hops = (step?.hops ?? []).filter((h) => h.from !== h.to);
    let cancelled = false;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => dot.setAttribute('cx', '-20');
    const run = (i: number) => {
      const h = hops[i];
      const p = h && node(h.from);
      const q = h && node(h.to);
      if (cancelled || !h || !p || !q) return hide();
      // 同じ線を複数の種類が通るときは、その種類の平行線の上を動かす
      const [a, b] = edgeKey(h.from, h.to, lesson.lanes.map((l) => l.id));
      const off = active.get(`${a}|${b}`)?.find((tr) => tr.kind === h.kind)?.offset ?? 0;
      const [ax1, ay1, ax2, ay2] = clipToBoxes(node(a)!, node(b)!);
      const [ox1, oy1, ox2, oy2] = offsetSegment(ax1, ay1, ax2, ay2, off);
      const [x1, y1, x2, y2] = h.from === a ? [ox1, oy1, ox2, oy2] : [ox2, oy2, ox1, oy1];
      const ex = h.lost ? (x1 + x2) / 2 : x2;
      const ey = h.lost ? (y1 + y2) / 2 : y2;
      dot.style.fill = KIND_COLOR[h.kind];
      const dur = Math.min(900, 320 + Math.hypot(ex - x1, ey - y1) * 1.4) / speed;
      const t0 = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const k = ease(Math.min(1, (now - t0) / dur));
        dot.setAttribute('cx', String(x1 + (ex - x1) * k));
        dot.setAttribute('cy', String(y1 + (ey - y1) * k));
        if (k < 1) raf = requestAnimationFrame(tick);
        else {
          hide();
          timer = setTimeout(() => run(i + 1), 160 / speed);
        }
      };
      raf = requestAnimationFrame(tick);
    };
    run(0);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      hide();
    };
    // node は layout から決まるので layout を依存に含める
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, layout, active, speed, reducedMotion]);

  return (
    <div className={styles.wrap}>
      <div
        className={styles.canvas}
        tabIndex={0}
        role="region"
        aria-label={t.topologyOf(lesson.title)}
        onKeyDown={(e) => {
          // 図にフォーカスがある間は、左右キーで図をスクロールする。
          if (e.target === e.currentTarget && e.currentTarget.scrollWidth > e.currentTarget.clientWidth && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) e.stopPropagation();
        }}
      >
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={t.topologyOf(lesson.title)} style={{ minWidth: Math.max(640, Math.round(layout.width * 0.8)), maxWidth: layout.width }}>
          <defs>
            {kinds.map((k) => (
              <marker key={k} id={`tp-${lesson.id}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: KIND_COLOR[k] }} />
              </marker>
            ))}
          </defs>
          {layout.edges.map((e) => {
            const p = node(e.a);
            const q = node(e.b);
            if (!p || !q) return null;
            const [x1, y1, x2, y2] = clipToBoxes(p, q);
            const tracks = active.get(`${e.a}|${e.b}`) ?? [];
            // ラベルは、平行線の束の外側から積み重ねる
            const spread = ((tracks.length - 1) * TRACK_GAP) / 2;
            return (
              <g key={`${e.a}|${e.b}`} className={styles.edge} onClick={() => onSelect?.(e.firstStep)}>
                <title>{`${lesson.lanes.find((l) => l.id === e.a)?.name} ⇄ ${lesson.lanes.find((l) => l.id === e.b)?.name}`}</title>
                {/* クリックしやすいよう、見えない太い線を下に敷く */}
                <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.hit} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.idle} />
                {tracks.map((tr) => {
                  const col = KIND_COLOR[tr.kind];
                  const marker = `url(#tp-${lesson.id}-${tr.kind})`;
                  const [sx1, sy1, sx2, sy2] = offsetSegment(x1, y1, x2, y2, tr.offset);
                  const mx = (sx1 + sx2) / 2;
                  const my = (sy1 + sy2) / 2;
                  return (
                    <g key={tr.kind}>
                      <line
                        x1={sx1}
                        y1={sy1}
                        x2={sx2}
                        y2={sy2}
                        style={{ stroke: col, strokeWidth: 2.6, strokeDasharray: tr.lostAll ? '5 4' : undefined }}
                        markerEnd={tr.forward ? marker : undefined}
                        markerStart={tr.backward ? marker : undefined}
                      />
                      {tr.lostAny && (
                        <g className={styles.cross}>
                          <line x1={mx - 5} y1={my - 5} x2={mx + 5} y2={my + 5} />
                          <line x1={mx - 5} y1={my + 5} x2={mx + 5} y2={my - 5} />
                        </g>
                      )}
                    </g>
                  );
                })}
                {tracks.map((tr, i) => {
                  const lp = labelPosition(x1, y1, x2, y2, 10 + spread + i * 15);
                  return (
                    <text key={tr.kind} x={lp.x} y={lp.y} textAnchor={lp.anchor} className={styles.edgeLabel} style={{ fill: KIND_COLOR[tr.kind] }}>
                      {trackLabel(tr, t)}
                    </text>
                  );
                })}
              </g>
            );
          })}
          {layout.nodes.map((n) => {
            const lane = lesson.lanes.find((l) => l.id === n.id);
            const icon = lane && deviceIcon(lane);
            const on = involved.has(n.id);
            const self = selfHops.find((h) => h.from === n.id);
            return (
              <g key={n.id} className={on ? styles.on : undefined}>
                {icon && <TopologyDevice icon={icon} x={n.x} y={n.y} className={styles.icon} />}
                <line x1={n.x - 18} y1={n.y + 35} x2={n.x + 18} y2={n.y + 35} className={styles.status} />
                <text x={n.x} y={n.y + 54} textAnchor="middle" className={styles.name}>{lane?.name}</text>
                {lane?.sub && <text x={n.x} y={n.y + 73} textAnchor="middle" className={styles.sub}>{lane.sub}</text>}
                {self && (
                  <text x={n.x} y={n.y + NODE_H / 2 + 20} textAnchor="middle" className={styles.edgeLabel} style={{ fill: KIND_COLOR[self.kind] }}>
                    {self.label}
                  </text>
                )}
              </g>
            );
          })}
          <circle ref={dotRef} r={6} cx={-20} cy={-20} className={styles.dot} aria-hidden="true" />
        </svg>
      </div>
      <p className={styles.hint}>{t.topologyHint}</p>
    </div>
  );
}
