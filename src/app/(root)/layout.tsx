import type { ReactNode } from 'react';
import '@/styles/globals.css';

export default function RootRedirectLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
