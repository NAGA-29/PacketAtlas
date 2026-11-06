import type { Lesson } from '@/lessons/types';
import { dict, type Locale } from '@/lib/i18n';
import styles from './Overview.module.css';

/** プロトコルの概要カード。規定は一次資料の一覧へリンクする */
export function Overview({ lesson, locale }: { lesson: Lesson; locale: Locale }) {
  const t = dict(locale);
  const o = lesson.overview;
  const specLink = (spec: string) => lesson.sources.find((s) => s.label.startsWith(spec))?.url;
  const rows: [string, React.ReactNode][] = [
    [t.overview.layer, o.layer],
    [t.overview.transport, o.transport],
    [t.overview.ports, o.ports],
    [t.overview.format, o.format],
    [o.key.label, o.key.value],
    [
      t.overview.specs,
      o.specs.map((s, i) => {
        const url = specLink(s);
        return (
          <span key={s}>
            {i > 0 && '、'}
            {url ? <a href={url} rel="noopener">{s}</a> : s}
          </span>
        );
      }),
    ],
  ];
  return (
    <section className={styles.card} aria-labelledby={`overview-${lesson.id}`}>
      <h2 id={`overview-${lesson.id}`} className={styles.title}>
        {t.overview.title}
      </h2>
      <dl className={styles.list}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.row}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
