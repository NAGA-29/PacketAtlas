// Ethernet II フレームと ARP(RFC 826)の最小限のエンコーダー(検証用)
import { uintBytes } from '../bytes';

export const ETHERTYPE = { IPv4: 0x0800, ARP: 0x0806, IPv6: 0x86dd } as const;
export const BROADCAST = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
/** FCS を除いたフレームの最小長 */
export const MIN_FRAME = 60;

export const mac = (s: string): number[] => {
  const b = s.split(':').map((x) => parseInt(x, 16));
  if (b.length !== 6 || b.some((x) => Number.isNaN(x))) throw new Error(`bad mac ${s}`);
  return b;
};

/** IEEE 802.3 の CRC-32(反射、多項式 0xEDB88320) */
export const crc32 = (data: ArrayLike<number>): number => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c ^= data[i] ?? 0;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};

/** FCS は CRC-32 を下位バイトから順に送る */
export const fcs = (frame: ArrayLike<number>): number[] => {
  const c = crc32(frame);
  return [c & 0xff, (c >>> 8) & 0xff, (c >>> 16) & 0xff, c >>> 24];
};

/** FCS 込みのフレーム全体の CRC は固定値(残余)になる */
export const CRC32_RESIDUE = 0x2144df1c;

export const ethernetHeader = (dst: number[], src: number[], type: number): number[] => [...dst, ...src, ...uintBytes(type, 2)];

/** ヘッダー + データ + 最小長までのゼロ埋め + FCS */
export const ethernetFrame = (dst: number[], src: number[], type: number, payload: ArrayLike<number>): { frame: number[]; padding: number; fcs: number[] } => {
  const body = [...ethernetHeader(dst, src, type), ...Array.from(payload)];
  const padding = Math.max(0, MIN_FRAME - body.length);
  const padded = [...body, ...new Array(padding).fill(0)];
  const f = fcs(padded);
  return { frame: [...padded, ...f], padding, fcs: f };
};

export const ARP_OP = { request: 1, reply: 2 } as const;

/** Ethernet / IPv4 の ARP パケット(28 バイト) */
export const arpPacket = (op: number, sha: number[], spa: number[], tha: number[], tpa: number[]): number[] => [
  0x00, 0x01, // ハードウェア種別 Ethernet
  0x08, 0x00, // プロトコル種別 IPv4
  6,
  4,
  ...uintBytes(op, 2),
  ...sha,
  ...spa,
  ...tha,
  ...tpa,
];
