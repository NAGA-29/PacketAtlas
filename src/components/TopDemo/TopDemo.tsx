'use client';
import { useEffect, useState } from 'react';
import type { Lesson } from '@/lessons/types';
import type { Locale } from '@/lib/i18n';
import { SequenceDiagram } from '../SequenceDiagram/SequenceDiagram';
import { useReducedMotion, useSpeed } from '../prefs';

/** トップに置く、1レッスンの図だけを順に動かす見本 */
export function TopDemo({ lesson, locale, steps = 4 }: { lesson: Lesson; locale: Locale; steps?: number }) {
  const reduced = useReducedMotion();
  const [speed] = useSpeed();
  const [current, setCurrent] = useState(0);
  const shown = { ...lesson, steps: lesson.steps.slice(0, steps) };
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % shown.steps.length), 3200);
    return () => clearInterval(timer);
  }, [reduced, shown.steps.length]);
  return (
    <SequenceDiagram
      lesson={shown}
      locale={locale}
      current={reduced ? shown.steps.length - 1 : current}
      speed={speed}
      reducedMotion={reduced}
      legend={false}
      maxHeight="340px"
    />
  );
}
