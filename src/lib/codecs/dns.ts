// RFC 1035 の DNS メッセージ(検証用)
import { ascii, uintBytes } from '../bytes';

export const TYPE = { A: 1, NS: 2, CNAME: 5, SOA: 6, AAAA: 28 } as const;
export const CLASS_IN = 1;
export const RCODE = { NOERROR: 0, FORMERR: 1, SERVFAIL: 2, NXDOMAIN: 3 } as const;

/** ラベル列に符号化する。末尾にゼロ長ラベル */
export const encodeName = (name: string): number[] => [
  ...name
    .split('.')
    .filter(Boolean)
    .flatMap((label) => {
      if (label.length > 63) throw new Error('label too long');
      return [label.length, ...ascii(label)];
    }),
  0,
];

/** 圧縮ポインター(先頭2bitが11、残り14bitがメッセージ先頭からのオフセット) */
export const pointer = (offset: number): number[] => [0xc0 | (offset >> 8), offset & 0xff];

/** 先頭のラベルだけ書き、残りをポインターで指す('ns1' + ポインター) */
export const labelThenPointer = (label: string, offset: number): number[] => [label.length, ...ascii(label), ...pointer(offset)];

export interface Flags {
  qr?: boolean;
  opcode?: number;
  aa?: boolean;
  tc?: boolean;
  rd?: boolean;
  ra?: boolean;
  ad?: boolean;
  cd?: boolean;
  rcode?: number;
}

export const flagsWord = (f: Flags): number =>
  (f.qr ? 0x8000 : 0) |
  ((f.opcode ?? 0) << 11) |
  (f.aa ? 0x0400 : 0) |
  (f.tc ? 0x0200 : 0) |
  (f.rd ? 0x0100 : 0) |
  (f.ra ? 0x0080 : 0) |
  (f.ad ? 0x0020 : 0) |
  (f.cd ? 0x0010 : 0) |
  ((f.rcode ?? 0) & 0xf);

export const header = (id: number, flags: Flags, counts: { qd?: number; an?: number; ns?: number; ar?: number }): number[] => [
  ...uintBytes(id, 2),
  ...uintBytes(flagsWord(flags), 2),
  ...uintBytes(counts.qd ?? 0, 2),
  ...uintBytes(counts.an ?? 0, 2),
  ...uintBytes(counts.ns ?? 0, 2),
  ...uintBytes(counts.ar ?? 0, 2),
];

export const question = (name: number[], type: number): number[] => [...name, ...uintBytes(type, 2), ...uintBytes(CLASS_IN, 2)];

export const rr = (name: number[], type: number, ttl: number, rdata: number[]): number[] => [
  ...name,
  ...uintBytes(type, 2),
  ...uintBytes(CLASS_IN, 2),
  ...uintBytes(ttl, 4),
  ...uintBytes(rdata.length, 2),
  ...rdata,
];

/** ポインターをたどりつつ名前を読む */
export const readName = (msg: ArrayLike<number>, offset: number): { name: string; next: number } => {
  const labels: string[] = [];
  let pos = offset;
  let next = -1;
  for (let guard = 0; guard < 128; guard++) {
    const len = msg[pos] ?? 0;
    if (len === 0) {
      if (next < 0) next = pos + 1;
      return { name: labels.join('.'), next };
    }
    if ((len & 0xc0) === 0xc0) {
      if (next < 0) next = pos + 2;
      pos = ((len & 0x3f) << 8) | (msg[pos + 1] ?? 0);
      continue;
    }
    labels.push(String.fromCharCode(...Array.from({ length: len }, (_, i) => msg[pos + 1 + i] ?? 0)));
    pos += 1 + len;
  }
  throw new Error('pointer loop');
};
