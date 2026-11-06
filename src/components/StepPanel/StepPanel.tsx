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
        <div className={styles.num}>{t.step(current + 1, steps.length)}</div>
        <h2 className={styles.title}>{st.title}</h2>
        <div className={styles.body}>
          <Markdown text={st.body} />
        </div>
      </div>
      <div className={styles.controls}>
        <button type="button" onClick={() => onGo(current - 1)} disabled={current === 0}>
          {t.prev}
        </button>
        <button type="button" className={styles.primary} onClick={onTogglePlay} aria-pressed={playing}>
          {playing ? t.pause : t.play}
        </button>
        <button type="button" onClick={() => onGo(current + 1)} disabled={current === last}>
          {t.next}
        </button>
        <div className={styles.speed} role="group" aria-label={t.speed}>
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => onSpeed(s)} className={styles.speedBtn}>
              {s}×
            </button>
          ))}
        </div>
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
              />
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}
