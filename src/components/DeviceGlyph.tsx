// 機器のアイコン(24×24 の線画)。SVG の中に <g> として埋め込む
import type { DeviceIcon } from '@/lessons/types';

const PATHS: Record<DeviceIcon, React.ReactNode> = {
  // 画面と台
  client: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M12 16v4M8 20h8" />
    </>
  ),
  // 封筒
  mail: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3.5 7l8.5 6.5L20.5 7" />
    </>
  ),
  // 3段の棚
  server: (
    <>
      <rect x="4" y="3" width="16" height="5" rx="1.5" />
      <rect x="4" y="9.5" width="16" height="5" rx="1.5" />
      <rect x="4" y="16" width="16" height="5" rx="1.5" />
      <path d="M7 5.5h.01M7 12h.01M7 18.5h.01" strokeWidth="2.4" />
    </>
  ),
  // 円と4方向の矢印(経路を振り分ける)
  router: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 5.5v5M10 7.5l2-2 2 2M12 18.5v-5M10 16.5l2 2 2-2M5.5 12h5M7.5 10l-2 2 2 2M18.5 12h-5M16.5 10l2 2-2 2" />
    </>
  ),
  // 箱と左右の矢印(同じネットワークで振り分ける)
  switch: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M7 10.5h9M14 8.5l2 2-2 2M17 13.5H8M10 11.5l-2 2 2 2" />
    </>
  ),
  // 虫めがね(名前を調べる)
  resolver: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </>
  ),
  // 2点を結ぶ中継
  relay: (
    <>
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
      <path d="M7.5 12h9M12 5v14M9.5 7.5L12 5l2.5 2.5M9.5 16.5L12 19l2.5-2.5" />
    </>
  ),
};

/** (x, y) を左上にして size の大きさで描く */
export function DeviceGlyph({ icon, x, y, size = 24, className }: { icon: DeviceIcon; x: number; y: number; size?: number; className?: string }) {
  const s = size / 24;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s})`}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[icon]}
    </g>
  );
}
