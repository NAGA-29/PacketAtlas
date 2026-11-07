import type { DeviceIcon } from '@/lessons/types';

// つながり図用の機器。96×96 の正面図を自前の線画で描く。
const LAPTOP = (
  <>
    <rect x="15" y="17" width="66" height="46" rx="4" fill="var(--panel)" />
    <rect x="21" y="23" width="54" height="33" rx="1" />
    <path d="M15 63 5 76v4h86v-4L81 63M5 76h86M37 76l2-6h18l2 6" />
    <path d="M26 68h5m4 0h5m4 0h5m4 0h5m4 0h5" />
  </>
);

const RACK = (
  <>
    <rect x="24" y="8" width="48" height="76" rx="4" fill="var(--panel)" />
    {[16, 36, 56].map((y) => (
      <g key={y}>
        <rect x="30" y={y} width="36" height="15" rx="2" />
        <circle cx="36" cy={y + 7.5} r="1.5" fill="currentColor" stroke="none" />
        <path d={`M44 ${y + 5}h15m-15 5h10`} />
      </g>
    ))}
    <path d="M32 84v4m32-4v4M34 77h28" />
  </>
);

const DEVICES: Record<DeviceIcon, React.ReactNode> = {
  client: LAPTOP,
  mail: (
    <>
      {LAPTOP}
      <rect x="32" y="30" width="32" height="20" rx="2" />
      <path d="m33 32 15 10 15-10" />
    </>
  ),
  server: RACK,
  resolver: (
    <>
      {RACK}
      <circle cx="69" cy="66" r="12" fill="var(--panel)" />
      <path d="m78 75 9 9M64 63h9m-9 6h6" />
    </>
  ),
  router: (
    <>
      <path d="M22 51V19a3 3 0 0 1 6 0v32M68 51V19a3 3 0 0 1 6 0v32" fill="var(--panel)" />
      <rect x="12" y="51" width="72" height="29" rx="5" fill="var(--panel)" />
      <path d="M19 80v5m58-5v5M20 61h10m-10 7h6" />
      <circle cx="34" cy="65" r="2" />
      {[46, 57, 68].map((x) => <rect key={x} x={x} y="61" width="7" height="9" rx="1" />)}
    </>
  ),
  switch: (
    <>
      <rect x="8" y="35" width="80" height="40" rx="4" fill="var(--panel)" />
      <path d="M15 75v6m66-6v6M17 44h22m18 0h22M35 40l4 4-4 4m26-8-4 4 4 4" />
      {[17, 30, 43, 56, 69].map((x) => <rect key={x} x={x} y="55" width="9" height="10" rx="1" />)}
    </>
  ),
  relay: (
    <>
      {RACK}
      <rect x="31" y="37" width="34" height="32" rx="2" fill="var(--panel)" />
      <path d="M37 47h22m-5-5 5 5-5 5M59 59H37m5-5-5 5 5 5" />
    </>
  ),
};

export function TopologyDevice({ icon, x, y, className }: { icon: DeviceIcon; x: number; y: number; className?: string }) {
  return (
    <g transform={`translate(${x - 52} ${y - 74}) scale(${104 / 96})`} className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {DEVICES[icon]}
    </g>
  );
}
