// IPv4 / UDP / TCP / ICMP の最小限のエンコーダー(検証用)
import { uintBytes } from '../bytes';

/** RFC 1071 のインターネットチェックサム(16bit 1の補数和の補数) */
export const internetChecksum = (data: ArrayLike<number>): number => {
  let sum = 0;
  for (let i = 0; i < data.length; i += 2) {
    sum += ((data[i] ?? 0) << 8) | (data[i + 1] ?? 0);
    sum = (sum & 0xffff) + (sum >>> 16);
  }
  return ~sum & 0xffff;
};

/** チェックサム欄を 0 のまま含めたデータに対して、正しい値なら和が 0xFFFF になる */
export const verifiesChecksum = (data: ArrayLike<number>): boolean => internetChecksum(data) === 0;

export const ipBytes = (ip: string): number[] => {
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((x) => !(x >= 0 && x <= 255))) throw new Error(`bad ip ${ip}`);
  return o;
};

export const PROTO = { ICMP: 1, TCP: 6, UDP: 17 } as const;

export interface Ipv4Spec {
  src: string;
  dst: string;
  protocol: number;
  payloadLength: number;
  id?: number;
  ttl?: number;
  dontFragment?: boolean;
  moreFragments?: boolean;
  fragmentOffset?: number; // 8バイト単位
  tos?: number;
}

/** 20 バイトの IPv4 ヘッダー(オプションなし、チェックサム計算済み) */
export const ipv4Header = (s: Ipv4Spec): number[] => {
  const flags = (s.dontFragment ? 0x4000 : 0) | (s.moreFragments ? 0x2000 : 0) | ((s.fragmentOffset ?? 0) & 0x1fff);
  const h = [
    0x45,
    s.tos ?? 0,
    ...uintBytes(20 + s.payloadLength, 2),
    ...uintBytes(s.id ?? 0, 2),
    ...uintBytes(flags, 2),
    s.ttl ?? 64,
    s.protocol,
    0,
    0,
    ...ipBytes(s.src),
    ...ipBytes(s.dst),
  ];
  const c = internetChecksum(h);
  h[10] = c >> 8;
  h[11] = c & 0xff;
  return h;
};

/** TCP / UDP のチェックサム用の疑似ヘッダー(12 バイト) */
export const pseudoHeader = (src: string, dst: string, protocol: number, length: number): number[] => [
  ...ipBytes(src),
  ...ipBytes(dst),
  0,
  protocol,
  ...uintBytes(length, 2),
];

export interface UdpSpec {
  src: string;
  dst: string;
  srcPort: number;
  dstPort: number;
  payload: ArrayLike<number>;
}

export const udpDatagram = (s: UdpSpec): number[] => {
  const len = 8 + s.payload.length;
  const seg = [...uintBytes(s.srcPort, 2), ...uintBytes(s.dstPort, 2), ...uintBytes(len, 2), 0, 0, ...Array.from(s.payload)];
  let c = internetChecksum([...pseudoHeader(s.src, s.dst, PROTO.UDP, len), ...seg]);
  if (c === 0) c = 0xffff; // UDP では 0 は「チェックサムなし」を意味する
  seg[6] = c >> 8;
  seg[7] = c & 0xff;
  return seg;
};

export const TCP_FLAG = { FIN: 0x01, SYN: 0x02, RST: 0x04, PSH: 0x08, ACK: 0x10, URG: 0x20, ECE: 0x40, CWR: 0x80 } as const;

export const TCP_OPT = {
  nop: [0x01],
  mss: (n: number) => [0x02, 0x04, ...uintBytes(n, 2)],
  windowScale: (s: number) => [0x03, 0x03, s],
  sackPermitted: [0x04, 0x02],
  sack: (blocks: [number, number][]) => [0x05, 2 + blocks.length * 8, ...blocks.flatMap(([l, r]) => [...uintBytes(l, 4), ...uintBytes(r, 4)])],
};

export interface TcpSpec {
  src: string;
  dst: string;
  srcPort: number;
  dstPort: number;
  seq: number;
  ack: number;
  flags: number;
  window: number;
  options?: number[];
  payload?: ArrayLike<number>;
}

export const tcpSegment = (s: TcpSpec): number[] => {
  const opts = s.options ?? [];
  if (opts.length % 4 !== 0) throw new Error('options must be padded to 4 bytes');
  const hlen = 20 + opts.length;
  const payload = Array.from(s.payload ?? []);
  const seg = [
    ...uintBytes(s.srcPort, 2),
    ...uintBytes(s.dstPort, 2),
    ...uintBytes(s.seq >>> 0, 4),
    ...uintBytes(s.ack >>> 0, 4),
    (hlen / 4) << 4,
    s.flags,
    ...uintBytes(s.window, 2),
    0,
    0,
    0,
    0,
    ...opts,
    ...payload,
  ];
  const c = internetChecksum([...pseudoHeader(s.src, s.dst, PROTO.TCP, seg.length), ...seg]);
  seg[16] = c >> 8;
  seg[17] = c & 0xff;
  return seg;
};

/** ICMP メッセージ(type, code, 4 バイトの残り, データ)。チェックサム計算済み */
export const icmpMessage = (type: number, code: number, rest: number[], data: ArrayLike<number>): number[] => {
  const m = [type, code, 0, 0, ...rest, ...Array.from(data)];
  const c = internetChecksum(m);
  m[2] = c >> 8;
  m[3] = c & 0xff;
  return m;
};

/** 32bit のシーケンス番号の足し算(周回する) */
export const seqAdd = (a: number, b: number): number => (a + b) >>> 0;
