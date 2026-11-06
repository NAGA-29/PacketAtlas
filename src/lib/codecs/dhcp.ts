// RFC 2131 / 2132 の DHCP メッセージ(検証用)
import { uintBytes } from '../bytes';

export const MAGIC_COOKIE = [0x63, 0x82, 0x53, 0x63];
export const MSG = { DISCOVER: 1, OFFER: 2, REQUEST: 3, DECLINE: 4, ACK: 5, NAK: 6, RELEASE: 7 } as const;
export const OPT = {
  SUBNET_MASK: 1,
  ROUTER: 3,
  DNS: 6,
  REQUESTED_IP: 50,
  LEASE_TIME: 51,
  MESSAGE_TYPE: 53,
  SERVER_ID: 54,
  PARAM_REQUEST: 55,
  RENEWAL_T1: 58,
  REBINDING_T2: 59,
  END: 255,
} as const;

export const opt = (code: number, data: number[]): number[] => [code, data.length, ...data];

export interface DhcpSpec {
  op: 1 | 2;
  xid: number;
  secs?: number;
  broadcast?: boolean;
  ciaddr?: number[];
  yiaddr?: number[];
  siaddr?: number[];
  giaddr?: number[];
  chaddr: number[];
  options: number[][];
}

const ZERO4 = [0, 0, 0, 0];

/** 固定部 236 バイト + マジッククッキー + オプション + END */
export const dhcpMessage = (s: DhcpSpec): number[] => [
  s.op,
  1, // htype Ethernet
  6, // hlen
  0, // hops
  ...uintBytes(s.xid, 4),
  ...uintBytes(s.secs ?? 0, 2),
  ...uintBytes(s.broadcast ? 0x8000 : 0, 2),
  ...(s.ciaddr ?? ZERO4),
  ...(s.yiaddr ?? ZERO4),
  ...(s.siaddr ?? ZERO4),
  ...(s.giaddr ?? ZERO4),
  ...s.chaddr,
  ...new Array(16 - s.chaddr.length).fill(0),
  ...new Array(64).fill(0), // sname
  ...new Array(128).fill(0), // file
  ...MAGIC_COOKIE,
  ...s.options.flat(),
  OPT.END,
];

/** 固定部の各欄の開始位置 */
export const OFFSET = { xid: 4, secs: 8, flags: 10, ciaddr: 12, yiaddr: 16, siaddr: 20, giaddr: 24, chaddr: 28, sname: 44, file: 108, cookie: 236, options: 240 } as const;
