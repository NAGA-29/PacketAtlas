import Link from 'next/link';
import { PARTS, catalog, getCompare, isLesson } from '@/lessons';
import type { DeviceIcon, PartNo } from '@/lessons/types';
import { dict, type Locale } from '@/lib/i18n';
import { DeviceGlyph } from '../DeviceGlyph';
import styles from './LearningMap.module.css';

const icons: DeviceIcon[] = ['relay', 'switch', 'resolver', 'router', 'mail', 'server'];

export function LearningMap({ locale, part, lessonId }: { locale: Locale; part: PartNo; lessonId: string }) {
  const t = dict(locale);
  return (
    <nav className={styles.map} aria-label={t.learningMap}>
      <div className={styles.heading}><strong>{t.learningMap}</strong><span>{t.catalogSize}</span></div>
      {PARTS.map((p, i) => (
        <details key={p.no} open={p.no === part} className={styles.part}>
          <summary>
            <span className={styles.number}>{p.no}</span>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><DeviceGlyph icon={icons[i] ?? 'relay'} x={0} y={0} /></svg>
            <span className={styles.label}><strong>{p.title}</strong><small>{p.summary}</small></span>
          </summary>
          <ul>
            {catalog(p.no).map((l) => (
              <li key={l.id}>{isLesson(l) ? (
                <Link href={`/${locale}/${l.id}/`} aria-current={l.id === lessonId ? 'page' : undefined}>
                  <strong>{l.title}</strong><small>{l.tagline}</small>
                </Link>
              ) : <span>{l.title} · {t.planned}</span>}</li>
            ))}
            {getCompare(p.no) && <li><Link className={styles.compare} href={`/${locale}/compare/${p.slug}/`}>{t.comparePage(p.no)} →</Link></li>}
          </ul>
        </details>
      ))}
      <Link className={styles.home} href={`/${locale}/`}>{t.allLessons} →</Link>
    </nav>
  );
}
