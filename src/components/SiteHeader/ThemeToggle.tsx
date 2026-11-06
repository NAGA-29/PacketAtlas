'use client';
import { useEffect, useState } from 'react';
import { dict, type Locale } from '@/lib/i18n';
import styles from './SiteHeader.module.css';

type Theme = 'system' | 'light' | 'dark';
const KEY = 'pa-theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];

/** <head> で先に実行し、ちらつきを防ぐ */
export const THEME_BOOT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function ThemeToggle({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    const v = document.documentElement.dataset.theme;
    setTheme(v === 'light' || v === 'dark' ? v : 'system');
  }, []);
  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* 保存できなくても切り替えは効く */
    }
  };
  return (
    <button type="button" className={styles.theme} onClick={cycle} aria-label={`${t.theme.label}: ${t.theme[theme]}`}>
      {t.theme.label}: {t.theme[theme]}
    </button>
  );
}
