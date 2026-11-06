// RFC 9000 の可変長整数とヘッダーの先頭バイト(検証用)

/** 可変長整数を読む。返り値は値と消費したバイト数 */
export const decodeVarint = (bytes: ArrayLike<number>): { value: number; length: number } => {
  const first = bytes[0];
  if (first === undefined) throw new Error('empty');
  const length = 1 << (first >> 6);
  let value = first & 0x3f;
  for (let i = 1; i < length; i++) value = value * 256 + (bytes[i] ?? 0);
  return { value, length };
};

/** 最短の可変長整数に符号化する */
export const encodeVarint = (value: number): number[] => {
  const len = value < 2 ** 6 ? 1 : value < 2 ** 14 ? 2 : value < 2 ** 30 ? 4 : 8;
  const prefix = { 1: 0, 2: 1, 4: 2, 8: 3 }[len] ?? 0;
  const out: number[] = [];
  let v = value;
  for (let i = 0; i < len; i++) {
    out.unshift(v % 256);
    v = Math.floor(v / 256);
  }
  out[0] = (out[0] ?? 0) | (prefix << 6);
  return out;
};

export const LONG_TYPE = { initial: 0, zeroRtt: 1, handshake: 2, retry: 3 } as const;

export const longHeaderFirstByte = (type: number, pnLength: number): number =>
  0x80 | 0x40 | ((type & 0x3) << 4) | ((pnLength - 1) & 0x3);

export const shortHeaderFirstByte = (pnLength: number, spin = 0, keyPhase = 0): number =>
  0x40 | ((spin & 1) << 5) | ((keyPhase & 1) << 2) | ((pnLength - 1) & 0x3);

export const FRAME = { STREAM: 0x08, PATH_CHALLENGE: 0x1a, PATH_RESPONSE: 0x1b, DATAGRAM: 0x30, DATAGRAM_LEN: 0x31 } as const;

export const streamFrameType = (off: boolean, len: boolean, fin: boolean): number =>
  FRAME.STREAM | (off ? 4 : 0) | (len ? 2 : 0) | (fin ? 1 : 0);

/** ストリームIDの下位2bit:始めた側と方向 */
export const streamKind = (id: number): { initiator: 'client' | 'server'; bidi: boolean } => ({
  initiator: id & 1 ? 'server' : 'client',
  bidi: (id & 2) === 0,
});

/** WebTransport over HTTP/3 の双方向ストリームの印 */
export const WT_BIDI_SIGNAL = 0x41;

/** ACK フレーム(RFC 9000 19.3)。受信済みの番号の区間を返す */
export const decodeAckFrame = (bytes: ArrayLike<number>): { largest: number; delay: number; received: [number, number][] } => {
  const arr = Array.from(bytes);
  let pos = 0;
  const next = () => {
    const r = decodeVarint(arr.slice(pos));
    pos += r.length;
    return r.value;
  };
  const type = next();
  if (type !== 0x02 && type !== 0x03) throw new Error('not an ACK frame');
  const largest = next();
  const delay = next();
  const rangeCount = next();
  const first = next();
  const received: [number, number][] = [[largest - first, largest]];
  let smallest = largest - first;
  for (let i = 0; i < rangeCount; i++) {
    const gap = next();
    const len = next();
    const hi = smallest - gap - 2;
    received.push([hi - len, hi]);
    smallest = hi - len;
  }
  return { largest, delay, received };
};

/** HTTP/3(RFC 9114)のフレーム種別とストリーム種別 */
export const H3 = { DATA: 0x00, HEADERS: 0x01, SETTINGS: 0x04, GOAWAY: 0x07 } as const;
export const H3_STREAM = { CONTROL: 0x00, PUSH: 0x01, QPACK_ENCODER: 0x02, QPACK_DECODER: 0x03 } as const;
export const H3_SETTING = { QPACK_MAX_TABLE_CAPACITY: 0x01, MAX_FIELD_SECTION_SIZE: 0x06, QPACK_BLOCKED_STREAMS: 0x07 } as const;

export const h3Frame = (type: number, payload: number[]): number[] => [...encodeVarint(type), ...encodeVarint(payload.length), ...payload];

/** QPACK(RFC 9204)の静的テーブルのうち使う部分 */
export const QPACK_STATIC: Record<number, [string, string]> = {
  0: [':authority', ''],
  1: [':path', '/'],
  17: [':method', 'GET'],
  23: [':scheme', 'https'],
  25: [':status', '200'],
};

export const qpack = {
  /** 動的テーブルを使わないときの接頭辞(Required Insert Count = 0, Base = 0) */
  prefix: [0x00, 0x00],
  /** 11xxxxxx:静的テーブルのインデックス(6 ビット接頭辞) */
  indexedStatic: (i: number): number[] => {
    if (i >= 63) throw new Error('index too large for this helper');
    return [0xc0 | i];
  },
  /** 0101xxxx:静的テーブルの名前 + リテラル値(N=0, T=1, 4 ビット接頭辞、H=0) */
  literalWithStaticName: (nameIndex: number, value: string): number[] => {
    if (nameIndex >= 15) throw new Error('index too large for this helper');
    const v = Array.from(value, (c) => c.charCodeAt(0));
    if (v.length >= 127) throw new Error('value too long for this helper');
    return [0x50 | nameIndex, v.length, ...v];
  },
};
