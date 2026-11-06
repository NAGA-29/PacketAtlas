import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import '@fontsource/ibm-plex-sans-jp/400.css';
import '@fontsource/ibm-plex-sans-jp/500.css';
import '@fontsource/ibm-plex-sans-jp/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@/styles/globals.css';
import { THEME_BOOT } from '@/components/SiteHeader/ThemeToggle';
import { LOCALES, dict, isLocale } from '@/lib/i18n';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = dict(locale);
  const title = `${t.siteName} — ${t.siteTagline}`;
  return {
    // OGP の画像などを絶対URLにするための基準。デプロイ時に SITE_URL を設定する
    metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
    title: { default: title, template: `%s · ${t.siteName}` },
    description: t.siteTagline,
    openGraph: {
      type: 'website',
      siteName: t.siteName,
      title,
      description: t.siteTagline,
      locale: 'ja_JP',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: `${t.siteName}:シーケンス図とバイト列の分解` }],
    },
    twitter: { card: 'summary_large_image', images: ['/og.png'] },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E9EDE8' },
    { media: '(prefers-color-scheme: dark)', color: '#11151B' },
  ],
};

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
