'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { HopKind, Lesson } from '@/lessons/types';
import { activeEdges, clipToBoxes, ICON_SPACE, labelPosition, layoutTopology, NODE_H } from '@/lib/topology';
import { deviceIcon } from '@/lib/device';
import { dict, type Locale } from '@/lib/i18n';
import { KIND_COLOR } from '../SequenceDiagram/SequenceDiagram';
import { DeviceGlyph } from '../DeviceGlyph';
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

/** 機器を箱、通信する組を線で示す。今の手順で使う線を色と矢印で強調し、パケットを順に動かす */
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
      const [x1, y1, x2, y2] = clipToBoxes(p, q);
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
  }, [step, layout, speed, reducedMotion]);

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={t.topologyOf(lesson.title)} style={{ maxWidth: Math.round(layout.width * 1.25) }}>
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
          const a = active.get(`${e.a}|${e.b}`);
          const col = a ? KIND_COLOR[a.kind] : 'var(--rule)';
          const marker = a ? `url(#tp-${lesson.id}-${a.kind})` : undefined;
          const lp = labelPosition(x1, y1, x2, y2);
          const firstLabel = a ? step?.hops.find((h) => h.from !== h.to && [h.from, h.to].includes(e.a) && [h.from, h.to].includes(e.b))?.label : undefined;
          return (
            <g key={`${e.a}|${e.b}`} className={styles.edge} onClick={() => onSelect?.(e.firstStep)}>
              <title>{`${lesson.lanes.find((l) => l.id === e.a)?.name} ⇄ ${lesson.lanes.find((l) => l.id === e.b)?.name}`}</title>
              {/* クリックしやすいよう、見えない太い線を下に敷く */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.hit} />
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                style={{ stroke: col, strokeWidth: a ? 2.6 : 1.6, strokeDasharray: a?.lost ? '5 4' : a ? undefined : '2 5' }}
                markerEnd={a?.forward ? marker : undefined}
                markerStart={a?.backward ? marker : undefined}
              />
              {firstLabel && (
                <text x={lp.x} y={lp.y} textAnchor={lp.anchor} className={styles.edgeLabel} style={{ fill: col }}>
                  {firstLabel}
                  {a?.lost ? t.lost : ''}
                </text>
              )}
            </g>
          );
        })}
        {layout.nodes.map((n) => {
          const lane = lesson.lanes.find((l) => l.id === n.id);
          const icon = lane && deviceIcon(lane);
          const on = involved.has(n.id);
          const self = selfHops.find((h) => h.from === n.id);
          const left = n.x - n.w / 2;
          const tx = icon ? n.x + ICON_SPACE / 2 : n.x;
          return (
            <g key={n.id} className={on ? styles.on : undefined}>
              <rect x={left} y={n.y - NODE_H / 2} width={n.w} height={NODE_H} rx={10} className={styles.node} />
              {icon && (
                <>
                  <rect x={left + 8} y={n.y - 17} width={34} height={34} rx={8} className={styles.iconBg} />
                  <DeviceGlyph icon={icon} x={left + 13} y={n.y - 12} className={styles.icon} />
                </>
              )}
              <text x={tx} y={n.y - 3} textAnchor="middle" className={styles.name}>{lane?.name}</text>
              {lane?.sub && <text x={tx} y={n.y + 15} textAnchor="middle" className={styles.sub}>{lane.sub}</text>}
              {self && (
                <text x={n.x} y={n.y + NODE_H / 2 + 18} textAnchor="middle" className={styles.edgeLabel} style={{ fill: KIND_COLOR[self.kind] }}>
                  {self.label}
                </text>
              )}
            </g>
          );
        })}
        <circle ref={dotRef} r={6} cx={-20} cy={-20} className={styles.dot} aria-hidden="true" />
      </svg>
      <p className={styles.hint}>{t.topologyHint}</p>
    </div>
  );
}
