'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { HopKind, Lesson } from '@/lessons/types';
import { ICON_TOP, LANE_TOP, layoutDiagram, selfBoxWidth } from '@/lib/diagram';
import { deviceIcon } from '@/lib/device';
import { DeviceGlyph } from '../DeviceGlyph';
import { dict, type Locale } from '@/lib/i18n';
import { TopologyView } from '../TopologyView/TopologyView';
import { useDiagramView } from '../prefs';
import styles from './SequenceDiagram.module.css';

export const KIND_COLOR: Record<HopKind, string> = {
  control: 'var(--blue)',
  signal: 'var(--ochre)',
  media: 'var(--mag)',
  data: 'var(--teal)',
};

interface Props {
  lesson: Pick<Lesson, 'id' | 'title' | 'lanes' | 'steps'>;
  locale: Locale;
  current: number;
  speed: number;
  reducedMotion: boolean;
  onSelect?: (step: number) => void;
  /** 凡例を出すか */
  legend?: boolean;
  /** スクロール領域の最大高さ(CSSの値) */
  maxHeight?: string;
  /** 「シーケンス / つながり」の切り替えを出すか */
  allowTopology?: boolean;
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export function SequenceDiagram({ lesson, locale, current, speed, reducedMotion, onSelect, legend = true, maxHeight, allowTopology = false }: Props) {
  const t = dict(locale);
  const [savedView, setView] = useDiagramView();
  const view = allowTopology ? savedView : 'sequence';
  const layout = useMemo(() => layoutDiagram(lesson), [lesson]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const stepRows = useMemo(() => layout.rows.filter((r) => r.step === current), [layout, current]);
  const [revealed, setRevealed] = useState(stepRows.length);

  // 現在の手順のパケットを順に動かす(描画前に矢印を隠すため layout effect)
  useLayoutEffect(() => {
    const dot = dotRef.current;
    const hide = () => dot?.setAttribute('cx', '-20');
    if (reducedMotion || !dot || view !== 'sequence') {
      setRevealed(stepRows.length);
      hide();
      return;
    }
    let cancelled = false;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setRevealed(0);
    const run = (i: number) => {
      if (cancelled) return;
      const r = stepRows[i];
      if (!r) {
        hide();
        return;
      }
      dot.style.fill = KIND_COLOR[r.hop.kind];
      if (r.x1 === r.x2) {
        setRevealed(i + 1);
        timer = setTimeout(() => run(i + 1), 260 / speed);
        return;
      }
      const end = r.lostAt ?? r.x2;
      const dur = Math.min(900, 320 + Math.abs(end - r.x1) * 1.4) / speed;
      const t0 = performance.now();
      dot.setAttribute('cy', String(r.y));
      const tick = (now: number) => {
        if (cancelled) return;
        const p = Math.min(1, (now - t0) / dur);
        dot.setAttribute('cx', String(r.x1 + (end - r.x1) * ease(p)));
        if (p < 1) raf = requestAnimationFrame(tick);
        else {
          hide();
          setRevealed(i + 1);
          timer = setTimeout(() => run(i + 1), 120 / speed);
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
  }, [stepRows, speed, reducedMotion, view]);

  // 現在の手順が見える位置までスクロール
  useEffect(() => {
    const sc = scrollRef.current;
    const svg = svgRef.current;
    const box = layout.steps[current];
    if (!sc || !svg || !box) return;
    const scale = svg.getBoundingClientRect().width / layout.width;
    sc.scrollTo({ top: Math.max(0, box.y0 * scale - 90), behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [current, layout, reducedMotion, view]);

  const kinds = Object.keys(KIND_COLOR) as HopKind[];

  return (
    <section className={styles.diagram} aria-label={t.diagram}>
      {allowTopology && (
        <div className={styles.views} role="group" aria-label={t.view.label}>
          {(['sequence', 'topology'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              {t.view[v]}
            </button>
          ))}
        </div>
      )}
      {view === 'topology' && <TopologyView lesson={lesson} locale={locale} current={current} speed={speed} reducedMotion={reducedMotion} onSelect={onSelect} />}
      <div hidden={view !== 'sequence'} className={styles.scroll} ref={scrollRef} style={maxHeight ? { maxHeight } : undefined} tabIndex={0} role="region" aria-label={t.diagramOf(lesson.title)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ maxWidth: Math.round(layout.width * 1.3), minWidth: Math.min(layout.width, 560) }}
          role="img"
          aria-label={t.diagramOf(lesson.title)}
        >
          <defs>
            {kinds.map((k) => (
              <marker key={k} id={`ah-${lesson.id}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" style={{ fill: KIND_COLOR[k] }} />
              </marker>
            ))}
          </defs>
          {lesson.lanes.map((lane) => {
            const x = layout.laneX[lane.id] ?? 0;
            return (
              <g key={lane.id}>
                <line x1={x} y1={LANE_TOP} x2={x} y2={layout.height - 6} className={styles.lane} />
                {(() => {
                  const icon = deviceIcon(lane);
                  return icon ? <DeviceGlyph icon={icon} x={x - 12} y={ICON_TOP} className={styles.laneIcon} /> : null;
                })()}
                <text x={x} y={48} textAnchor="middle" className={styles.laneName}>{lane.name}</text>
                {lane.sub && <text x={x} y={65} textAnchor="middle" className={styles.laneSub}>{lane.sub}</text>}
              </g>
            );
          })}
          {lesson.steps.map((st, si) => {
            const box = layout.steps[si];
            if (!box) return null;
            const state = si === current ? styles.cur : si < current ? styles.past : styles.fut;
            return (
              <g
                key={st.id}
                className={`${styles.step} ${state}`}
                onClick={() => onSelect?.(si)}
                data-step={si}
              >
                <title>{`${si + 1}. ${st.title}`}</title>
                <circle cx={22} cy={box.y0} r={11} className={styles.num} />
                <text x={22} y={box.y0 + 4} textAnchor="middle" className={styles.numText}>{si + 1}</text>
                {box.y1 > box.y0 && <line x1={22} y1={box.y0 + 11} x2={22} y2={box.y1} className={styles.numLine} />}
                {layout.rows.filter((r) => r.step === si).map((r) => {
                  const col = KIND_COLOR[r.hop.kind];
                  const waiting = si === current && r.index >= revealed;
                  const cls = `${styles.hop} ${waiting ? styles.wait : ''}`;
                  if (r.x1 === r.x2) {
                    const w = selfBoxWidth(r.hop.label);
                    return (
                      <g key={r.index} className={cls}>
                        <rect x={r.x1 - w / 2} y={r.y - 12} width={w} height={24} rx={5} style={{ fill: 'var(--panel)', stroke: col, strokeWidth: 1.4 }} />
                        <text x={r.x1} y={r.y + 4} textAnchor="middle" className={styles.label} style={{ fill: col }}>{r.hop.label}</text>
                      </g>
                    );
                  }
                  const mid = (r.x1 + r.x2) / 2;
                  return (
                    <g key={r.index} className={cls}>
                      {r.lostAt !== undefined ? (
                        <>
                          <line x1={r.x1} y1={r.y} x2={r.lostAt} y2={r.y} style={{ stroke: col, strokeWidth: 1.6, strokeDasharray: '4 4' }} />
                          <g className={styles.cross}>
                            <line x1={r.lostAt - 6} y1={r.y - 6} x2={r.lostAt + 6} y2={r.y + 6} />
                            <line x1={r.lostAt - 6} y1={r.y + 6} x2={r.lostAt + 6} y2={r.y - 6} />
                          </g>
                        </>
                      ) : (
                        <line x1={r.x1} y1={r.y} x2={r.x2} y2={r.y} markerEnd={`url(#ah-${lesson.id}-${r.hop.kind})`} style={{ stroke: col, strokeWidth: 1.6 }} />
                      )}
                      <text x={mid} y={r.y - 7} textAnchor="middle" className={`${styles.label} ${styles.halo}`} style={{ fill: col }}>
                        {r.hop.label}
                        {r.hop.lost ? t.lost : ''}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
          <circle ref={dotRef} r={5.5} cx={-20} cy={-20} className={styles.dot} aria-hidden="true" />
        </svg>
      </div>
      {legend && (
        <div className={styles.legend}>
          {kinds.map((k) => (
            <span key={k} style={{ color: KIND_COLOR[k] }}>
              {t.legend[k]}
            </span>
          ))}
          <span className={styles.lostKey}>× {t.lost.replace(/[()()]/g, '')}</span>
          {onSelect && <em>{t.legendHint}</em>}
        </div>
      )}
    </section>
  );
}
