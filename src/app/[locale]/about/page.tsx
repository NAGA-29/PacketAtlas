import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { orderedLessons } from '@/lessons';
import { SiteHeader } from '@/components/SiteHeader/SiteHeader';
import { LOCALES, dict, isLocale } from '@/lib/i18n';
import styles from '../page.module.css';

export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = { title: '資料とライセンス' };

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dict(locale);
  return (
    <div className="wrap">
      <SiteHeader locale={locale} />
      <main id="main" className={styles.prose}>
        <h1 className={styles.title}>{t.about}</h1>

        <h2>このサイトのバイト列について</h2>
        <p>
          表示している16進は、RFCなどの一次資料をもとに書き起こし、テストで再計算して確かめています。乱数・チェックサム・暗号化された部分など、再計算に意味のない値は「(例)」と書くか「…」で省略しています。
        </p>
        <p>
          例のアドレスは文書用に予約された範囲(192.0.2.0/24・198.51.100.0/24・203.0.113.0/24、2001:db8::/32)と、example.com / example.net だけを使っています。NATの内側を表すときだけプライベートアドレスを使います。
        </p>

        <h2>架空フォーマット</h2>
        <p>
          「ゲームのネットコード」章のバイナリは、解説のために作った架空のフォーマットです。実際のゲームはそれぞれ独自の形式を使います。該当するパケットには画面上で必ず注記を出しています。
        </p>

        <h2>{t.sources}</h2>
        {orderedLessons().map((l) => (
          <section key={l.id}>
            <h3>
              <Link href={`/${locale}/${l.id}/`}>{l.title}</Link>
            </h3>
            <ul>
              {l.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener">{s.label}</a>
                </li>
              ))}
            </ul>
            <p className={styles.verified}>{t.lastVerified(l.lastVerified)}</p>
          </section>
        ))}

        <h2>ライセンス</h2>
        <p>
          書体は IBM Plex Sans JP と IBM Plex Mono(SIL Open Font License 1.1)を自己ホストしています。図・本文・コードはこのサイトのために書き下ろしたものです。
        </p>
      </main>
    </div>
  );
}
