import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LESSONS, getLesson, getPart, lessonNeighbors } from '@/lessons';
import { LessonPlayer } from '@/components/LessonPlayer/LessonPlayer';
import { LessonNav } from '@/components/LessonNav/LessonNav';
import { Overview } from '@/components/Overview/Overview';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { InlineMarkdown, plain } from '@/lib/markdown';
import { LOCALES, dict, isLocale } from '@/lib/i18n';
import styles from '../page.module.css';

type Params = Promise<{ locale: string; lesson: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.flatMap((locale) => LESSONS.map((l) => ({ locale, lesson: l.id })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lesson: id } = await params;
  const lesson = getLesson(id);
  if (!lesson) return {};
  return { title: lesson.title, description: plain(lesson.lead) };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { locale, lesson: id } = await params;
  const lesson = getLesson(id);
  if (!isLocale(locale) || !lesson) notFound();
  const t = dict(locale);
  const part = getPart(lesson.part);
  const { prev, next } = lessonNeighbors(lesson.id, locale);
  return (
    <div className="wrap">
      <SiteHeader locale={locale} part={lesson.part} lessonId={lesson.id} />
      <main id="main">
        <p className={styles.eyebrow}>
          {t.part(part.no)} {part.title}
        </p>
        <h1 className={styles.title}>{lesson.title}</h1>
        <p className={styles.lead}>
          <InlineMarkdown text={lesson.lead} />
        </p>
        <LessonPlayer lesson={lesson} locale={locale} overview={<Overview lesson={lesson} locale={locale} />} />
        <section className={styles.sources} aria-labelledby="sources">
          <h2 id="sources">{t.sources}</h2>
          <ul>
            {lesson.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener">{s.label}</a>
              </li>
            ))}
          </ul>
          <p className={styles.verified}>{t.lastVerified(lesson.lastVerified)}</p>
        </section>
        <LessonNav prev={prev} next={next} locale={locale} />
      </main>
    </div>
  );
}
