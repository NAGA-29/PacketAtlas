import { DEFAULT_LOCALE } from '@/lib/i18n';

export const metadata = { title: 'Packet Atlas', robots: { index: false } };

// 静的書き出しなのでサーバーのリダイレクトは使えない。meta refresh で既定の言語へ送る
export default function RootPage() {
  const href = `/${DEFAULT_LOCALE}/`;
  return (
    <main className="wrap">
      <meta httpEquiv="refresh" content={`0; url=${href}`} />
      <p>
        <a href={href}>Packet Atlas(日本語)へ</a>
      </p>
    </main>
  );
}
