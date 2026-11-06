'use client';
import { useMemo } from 'react';
import type { HopKind, Lesson } from '@/lessons/types';
import { activeEdges, clipToBoxes, labelPosition, layoutTopology, NODE_H } from '@/lib/topology';
import { dict, type Locale } from '@/lib/i18n';
import { KIND_COLOR } from '../SequenceDiagram/SequenceDiagram';
import styles from './TopologyView.module.css';

interface Props {
  lesson: Pick<Lesson, 'id' | 'title' | 'lanes' | 'steps'>;
  locale: Locale;
  current: number;
  onSelect?: (step: number) => void;
}

/** 機器を箱、通信する組を線で示す。今の手順で使う線を色と矢印で強調する */
export function TopologyView({ lesson, locale, current, onSelect }: Props) {
  const t = dict(locale);
  const layout = useMemo(() => layoutTopology(lesson), [lesson]);
  const active = useMemo(() => activeEdges(lesson, current), [lesson, current]);
  const step = lesson.steps[current];
  const selfHops = (step?.hops ?? []).filter((h) => h.from === h.to);
  const involved = new Set((step?.hops ?? []).flatMap((h) => [h.from, h.to]));
  const node = (id: string) => layout.nodes.find((n) => n.id === id);
  const kinds = Object.keys(KIND_COLOR) as HopKind[];

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
                style={{ stroke: col, strokeWidth: a ? 2.6 : 1.6, strokeDasharray: a?.lost ? '5 4' : undefined }}
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
          const on = involved.has(n.id);
          const self = selfHops.find((h) => h.from === n.id);
          return (
            <g key={n.id}>
              <rect x={n.x - n.w / 2} y={n.y - NODE_H / 2} width={n.w} height={NODE_H} rx={8} className={on ? styles.nodeOn : styles.node} />
              <text x={n.x} y={n.y - 4} textAnchor="middle" className={styles.name}>{lane?.name}</text>
              {lane?.sub && <text x={n.x} y={n.y + 14} textAnchor="middle" className={styles.sub}>{lane.sub}</text>}
              {self && (
                <text x={n.x} y={n.y + NODE_H / 2 + 18} textAnchor="middle" className={styles.edgeLabel} style={{ fill: KIND_COLOR[self.kind] }}>
                  {self.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className={styles.hint}>{t.topologyHint}</p>
    </div>
  );
}
