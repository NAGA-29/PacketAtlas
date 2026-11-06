// RFC 9113 の HTTP/2 フレームと RFC 7541 の HPACK(ハフマン符号は使わない)
import { ascii, uintBytes } from '../bytes';

export const PREFACE = ascii('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');
export const FRAME = { DATA: 0x0, HEADERS: 0x1, PRIORITY: 0x2, RST_STREAM: 0x3, SETTINGS: 0x4, PUSH_PROMISE: 0x5, PING: 0x6, GOAWAY: 0x7, WINDOW_UPDATE: 0x8, CONTINUATION: 0x9 } as const;
export const FLAG = { END_STREAM: 0x1, ACK: 0x1, END_HEADERS: 0x4, PADDED: 0x8, PRIORITY: 0x20 } as const;
export const SETTING = { HEADER_TABLE_SIZE: 1, ENABLE_PUSH: 2, MAX_CONCURRENT_STREAMS: 3, INITIAL_WINDOW_SIZE: 4, MAX_FRAME_SIZE: 5, MAX_HEADER_LIST_SIZE: 6 } as const;

/** 9 バイトのフレームヘッダー + 本体 */
export const frame = (type: number, flags: number, streamId: number, payload: number[]): number[] => [
  ...uintBytes(payload.length, 3),
  type,
  flags,
  ...uintBytes(streamId & 0x7fffffff, 4),
  ...payload,
];

export const settings = (pairs: [number, number][]): number[] => pairs.flatMap(([id, v]) => [...uintBytes(id, 2), ...uintBytes(v, 4)]);

/** HPACK の整数表現(N ビットの接頭辞) */
export const hpackInt = (value: number, prefixBits: number, firstByteHigh = 0): number[] => {
  const max = (1 << prefixBits) - 1;
  if (value < max) return [firstByteHigh | value];
  const out = [firstByteHigh | max];
  let v = value - max;
  while (v >= 128) {
    out.push((v % 128) + 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
};

/** ハフマンを使わない文字列リテラル(H=0) */
export const hpackString = (s: string): number[] => {
  const b = ascii(s);
  return [...hpackInt(b.length, 7, 0), ...b];
};

/** 静的テーブル(RFC 7541 付録A)のうち、このサイトで使う部分 */
export const STATIC: Record<number, [string, string]> = {
  1: [':authority', ''],
  2: [':method', 'GET'],
  3: [':method', 'POST'],
  4: [':path', '/'],
  5: [':path', '/index.html'],
  6: [':scheme', 'http'],
  7: [':scheme', 'https'],
  8: [':status', '200'],
  13: [':status', '404'],
  31: ['content-type', ''],
};
export const DYNAMIC_BASE = 62;

export const hpack = {
  /** 1xxxxxxx:インデックスで表す */
  indexed: (i: number) => hpackInt(i, 7, 0x80),
  /** 01xxxxxx:名前はインデックス、値はリテラル。動的テーブルに追加する */
  incremental: (nameIndex: number, value: string) => [...hpackInt(nameIndex, 6, 0x40), ...hpackString(value)],
  /** 0000xxxx:名前はインデックス、値はリテラル。テーブルに追加しない */
  withoutIndexing: (nameIndex: number, value: string) => [...hpackInt(nameIndex, 4, 0x00), ...hpackString(value)],
};
