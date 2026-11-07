'use client';
import type { Step } from '@/lessons/types';
import { Markdown } from '@/lib/markdown';
import { dict, type Locale } from '@/lib/i18n';
import { SPEEDS, type Speed } from '../prefs';
import styles from './StepPanel.module.css';

interface Props {
  steps: Step[];
  current: number;
  locale: Locale;
  playing: boolean;
  speed: Speed;
  onGo: (i: number) => void;
  onTogglePlay: () => void;
  onSpeed: (s: Speed) => void;
}

export function StepPanel({ steps, current, locale, playing, speed, onGo, onTogglePlay, onSpeed }: Props) {
  const t = dict(locale);
  const st = steps[current];
  if (!st) return null;
  const last = steps.length - 1;
  return (
    <article className={styles.step}>
      <div aria-live="polite" aria-atomic="true">
        <div className={styles.num}><span>{t.selectedStep}</span><span>{t.step(current + 1, steps.length)}</span></div>
        <h2 className={styles.title}>{st.title}</h2>
        <div className={styles.body}>
          <Markdown text={st.body} />
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => onGo(current - 1)} disabled={current === 0}>
          {t.prev}
        </button>
        <button type="button" onClick={onTogglePlay} aria-pressed={playing}>
          {playing ? t.pause : t.play}
        </button>
        <button type="button" className={styles.primary} onClick={() => onGo(current + 1)} disabled={current === last}>
          {t.next}
        </button>
        <label className={styles.speed}>
          <span className="visually-hidden">{t.speed}</span>
          <select value={speed} onChange={(e) => onSpeed(Number(e.target.value) as Speed)}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
        <ol className={styles.dots} aria-label={t.lessonsNav}>
          {steps.map((s, k) => (
            <li key={s.id}>
              <button
                type="button"
                className={k === current ? styles.on : undefined}
                aria-current={k === current ? 'step' : undefined}
                aria-label={`${k + 1}. ${s.title}`}
                title={`${k + 1}. ${s.title}`}
                onClick={() => onGo(k)}
              >{k + 1}</button>
            </li>
          ))}
        </ol>
      </div>
      <div className={styles.keys} aria-hidden="true"><kbd>←</kbd><kbd>→</kbd> {t.keyboardSteps}<span /><kbd>Space</kbd> {t.keyboardPlay}</div>
    </article>
  );
}
