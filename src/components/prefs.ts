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
