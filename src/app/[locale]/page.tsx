import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PARTS, catalog, getCompare, getLesson, isLesson } from '@/lessons';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { TopDemo } from '@/components/TopDemo/TopDemo';
import { dict, isLocale } from '@/lib/i18n';
import styles from './page.module.css';

// フェーズ4で HTTPS の通しレッスンに差し替える
const DEMO_LESSON = 'websocket';

export default async function TopPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dict(locale);
  const demo = getLesson(DEMO_LESSON);
  return (
    <div className="wrap">
      <SiteHeader locale={locale} />
      <main id="main">
        <section className={styles.hero}>
          <div>
            <h1>{t.siteTagline}</h1>
            <p>
              パケットが機器のあいだを飛ぶシーケンス図と、1バイトずつの分解で、プロトコルが実際に何を送っているかを見ていきます。
            </p>
            <p>下の層から上の層へ、6部21レッスン。バイト列はRFCなどの一次資料から起こし、テストで再計算しています。</p>
            {demo && (
              <p>
                <Link href={`/${locale}/${demo.id}/`}>{demo.title} のレッスンから始める →</Link>
              </p>
            )}
          </div>
          {demo && <TopDemo lesson={demo} locale={locale} />}
        </section>

        <div className={styles.parts}>
          {PARTS.map((p) => {
            const items = catalog(p.no);
            const cmp = getCompare(p.no);
            return (
              <section key={p.no} id={`part-${p.no}`} className={styles.part} aria-labelledby={`part-${p.no}-h`}>
                <h2 id={`part-${p.no}-h`}>
                  <small>{t.part(p.no)}</small>
                  {p.title}
                </h2>
                <p>{p.summary}</p>
                <ol>
                  {items.map((l) => (
                    <li key={l.id}>
                      {isLesson(l) ? (
                        <Link href={`/${locale}/${l.id}/`}>{l.title}</Link>
                      ) : (
                        <span className={styles.planned}>
                          {l.title}
                          <span className={styles.badge}>{t.planned}</span>
                        </span>
                      )}
                      <span className="tag">{l.tagline}</span>
                    </li>
                  ))}
                </ol>
                {cmp && (
                  <Link className={styles.compareLink} href={`/${locale}/compare/${p.slug}/`}>
                    {t.comparePage(p.no)} →
                  </Link>
                )}
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
