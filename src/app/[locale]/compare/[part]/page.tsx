import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { COMPARES, getCompare, getLesson, getPart, getPartBySlug } from '@/lessons';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { LessonNav } from '@/components/LessonNav/LessonNav';
import { InlineMarkdown, plain } from '@/lib/markdown';
import { LOCALES, dict, isLocale } from '@/lib/i18n';
import styles from '../../page.module.css';

type Params = Promise<{ locale: string; part: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => COMPARES.map((c) => ({ locale, part: getPart(c.part).slug })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { part: slug } = await params;
  const part = getPartBySlug(slug);
  const cmp = part && getCompare(part.no);
  return cmp ? { title: cmp.title, description: plain(cmp.lead) } : {};
}

export default async function ComparePage({ params }: { params: Params }) {
  const { locale, part: slug } = await params;
  const part = getPartBySlug(slug);
  const cmp = part && getCompare(part.no);
  if (!isLocale(locale) || !part || !cmp) notFound();
  const t = dict(locale);
  const lastLesson = [...cmp.columns].reverse().find((c) => c.lessonId);
  const prevLesson = lastLesson?.lessonId ? getLesson(lastLesson.lessonId) : undefined;
  return (
    <div className="wrap">
      <SiteHeader locale={locale} part={part.no} compare />
      <main id="main">
        <p className={styles.eyebrow}>
          {t.part(part.no)} {part.title}
        </p>
        <h1 className={styles.title}>{cmp.title}</h1>
        <p className={styles.lead}>
          <InlineMarkdown text={cmp.lead} />
        </p>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={cmp.title}>
          <table className={styles.compare}>
            <thead>
              <tr>
                <td />
                {cmp.columns.map((c) => (
                  <th key={c.name} scope="col">
                    {c.lessonId ? <Link href={`/${locale}/${c.lessonId}/`}>{c.name}</Link> : c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.aspects.map((a) => (
                <tr key={a.id}>
                  <th scope="row">{a.label}</th>
                  {cmp.columns.map((c) => (
                    <td key={c.name}>{c.cells[a.id] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cmp.notes && (
          <ul className={styles.notes}>
            {cmp.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className={styles.verified}>{t.lastVerified(cmp.lastVerified)}</p>
        <LessonNav
          locale={locale}
          prev={prevLesson ? { href: `/${locale}/${prevLesson.id}/`, label: prevLesson.title } : undefined}
          next={{ href: `/${locale}/`, label: t.top }}
        />
      </main>
    </div>
  );
}
