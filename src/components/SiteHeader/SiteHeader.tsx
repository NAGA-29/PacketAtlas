import Link from 'next/link';
import { PARTS, catalog, getPart, isLesson, lessonsInPart, COMPARE_PARTS } from '@/lessons';
import type { PartNo } from '@/lessons/types';
import { dict, type Locale } from '@/lib/i18n';
import { DeviceGlyph } from '../DeviceGlyph';
import { ThemeToggle } from './ThemeToggle';
import styles from './SiteHeader.module.css';

interface Props {
  locale: Locale;
  part?: PartNo;
  lessonId?: string;
  compare?: boolean;
}

export function SiteHeader({ locale, part, lessonId, compare }: Props) {
  const t = dict(locale);
  const lessons = part ? lessonsInPart(part) : [];
  return (
    <header className={styles.header}>
      <a className="skip" href="#main">{t.skip}</a>
      <Link href={`/${locale}/`} className={styles.logo}>
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><DeviceGlyph icon="switch" x={0} y={0} /></svg>
        {t.siteName}
      </Link>
      <span className={styles.caption}>{t.brandCaption}</span>
      {part && (
        <details className={styles.parts}>
          <summary>
            {t.part(part)} {getPart(part).title}
            <span aria-hidden="true"> ▾</span>
            <span className="visually-hidden">{t.partsMenu}</span>
          </summary>
          <ul>
            {PARTS.map((p) => {
              const first = catalog(p.no).find(isLesson);
              const href = first ? `/${locale}/${first.id}/` : `/${locale}/#part-${p.no}`;
              return (
                <li key={p.no}>
                  <Link href={href} aria-current={p.no === part ? 'true' : undefined}>
                    {t.part(p.no)} {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {lessons.length > 0 && (
        <nav className={styles.tabs} aria-label={t.lessonsNav}>
          {lessons.map((l) => (
            <Link key={l.id} href={`/${locale}/${l.id}/`} aria-current={l.id === lessonId ? 'page' : undefined}>
              {l.title}
            </Link>
          ))}
          {part && COMPARE_PARTS.includes(part) && (
            <Link href={`/${locale}/compare/${getPart(part).slug}/`} aria-current={compare ? 'page' : undefined}>
              {t.compare}
            </Link>
          )}
        </nav>
      )}
      <div className={styles.tools}>
        <Link href={`/${locale}/about/`} className={styles.about}>{t.about}</Link>
        <ThemeToggle locale={locale} />
      </div>
    </header>
  );
}
