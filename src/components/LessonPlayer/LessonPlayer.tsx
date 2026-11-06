'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Lesson } from '@/lessons/types';
import type { Locale } from '@/lib/i18n';
import { SequenceDiagram } from '../SequenceDiagram/SequenceDiagram';
import { StepPanel } from '../StepPanel/StepPanel';
import { PacketInspector } from '../PacketInspector/PacketInspector';
import { useReducedMotion, useSpeed } from '../prefs';
import styles from './LessonPlayer.module.css';

const AUTOPLAY_MS = 5200;

const isInteractive = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && Boolean(el.closest('button, a, input, select, textarea, summary, [contenteditable="true"]'));

export function LessonPlayer({ lesson, locale }: { lesson: Lesson; locale: Locale }) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useSpeed();
  const reducedMotion = useReducedMotion();
  const last = lesson.steps.length - 1;
  const currentRef = useRef(current);
  currentRef.current = current;

  const indexOfHash = useCallback(
    (hash: string) => lesson.steps.findIndex((s) => s.id === decodeURIComponent(hash.replace(/^#/, ''))),
    [lesson],
  );

  // URL のハッシュ ↔ 手順
  useEffect(() => {
    const sync = () => {
      const i = indexOfHash(location.hash);
      if (i >= 0) setCurrent(i);
    };
    sync();
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, [indexOfHash]);

  const go = useCallback(
    (i: number, fromPlay = false) => {
      const next = Math.max(0, Math.min(last, i));
      if (!fromPlay) setPlaying(false);
      setCurrent(next);
      const id = lesson.steps[next]?.id;
      if (id) history.replaceState(null, '', `#${id}`);
    },
    [last, lesson],
  );

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const togglePlay = useCallback(() => {
    if (playingRef.current) {
      setPlaying(false);
      return;
    }
    if (currentRef.current === last) go(0, true);
    setPlaying(true);
  }, [go, last]);

  // 自動再生
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      if (currentRef.current >= last) {
        setPlaying(false);
        return;
      }
      go(currentRef.current + 1, true);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [playing, last, go]);

  // ←→ で移動、Space で自動再生
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight') {
        if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
        e.preventDefault();
        go(currentRef.current + 1);
      } else if (e.key === 'ArrowLeft') {
        if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea')) return;
        e.preventDefault();
        go(currentRef.current - 1);
      } else if (e.key === ' ' && !isInteractive(e.target) && !(e.target instanceof HTMLTableRowElement)) {
        e.preventDefault();
        togglePlay();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, togglePlay]);

  const step = lesson.steps[current];

  return (
    <div className={styles.grid}>
      <div className={styles.diagramCol}>
        <SequenceDiagram
          lesson={lesson}
          locale={locale}
          current={current}
          speed={speed}
          reducedMotion={reducedMotion}
          onSelect={(i) => go(i)}
        />
      </div>
      <div className={styles.side}>
        <StepPanel
          steps={lesson.steps}
          current={current}
          locale={locale}
          playing={playing}
          speed={speed}
          onGo={(i) => go(i)}
          onTogglePlay={togglePlay}
          onSpeed={setSpeed}
        />
        <PacketInspector key={`${lesson.id}-${current}`} packet={step?.packet} locale={locale} />
      </div>
    </div>
  );
}
