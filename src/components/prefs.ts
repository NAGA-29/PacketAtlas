'use client';
import { useCallback, useEffect, useState } from 'react';

export const SPEEDS = [0.5, 1, 2] as const;
export type Speed = (typeof SPEEDS)[number];
const SPEED_KEY = 'pa-speed';

const readSpeed = (): Speed => {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return (SPEEDS as readonly number[]).includes(v) ? (v as Speed) : 1;
  } catch {
    return 1;
  }
};

/** アニメーション速度(localStorage に保存) */
export function useSpeed(): [Speed, (s: Speed) => void] {
  const [speed, setSpeedState] = useState<Speed>(1);
  useEffect(() => setSpeedState(readSpeed()), []);
  const setSpeed = useCallback((s: Speed) => {
    setSpeedState(s);
    try {
      localStorage.setItem(SPEED_KEY, String(s));
    } catch {
      /* 保存できなくても動作は続ける */
    }
  }, []);
  return [speed, setSpeed];
}

/** prefers-reduced-motion */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

export type DiagramView = 'sequence' | 'topology';
const VIEW_KEY = 'pa-view';

/** 図の表示(シーケンス / つながり)。localStorage に保存 */
export function useDiagramView(): [DiagramView, (v: DiagramView) => void] {
  const [view, setViewState] = useState<DiagramView>('sequence');
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'topology') setViewState('topology');
    } catch {
      /* 読めなければ既定のまま */
    }
  }, []);
  const setView = useCallback((v: DiagramView) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* 保存できなくても切り替えは効く */
    }
  }, []);
  return [view, setView];
}
