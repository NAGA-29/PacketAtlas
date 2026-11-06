import Link from 'next/link';
import type { NavLink } from '@/lessons';
import { dict, type Locale } from '@/lib/i18n';
import styles from './LessonNav.module.css';

export function LessonNav({ prev, next, locale }: { prev?: NavLink; next?: NavLink; locale: Locale }) {
  const t = dict(locale);
  return (
    <nav className={styles.nav} aria-label={`${t.prevLesson} / ${t.nextLesson}`}>
      {prev ? (
        <Link href={prev.href} rel="prev" className={styles.prev}>
          <small>← {t.prevLesson}</small>
          {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={next.href} rel="next" className={styles.next}>
          <small>{t.nextLesson} →</small>
          {next.label}
        </Link>
      )}
    </nav>
  );
}
