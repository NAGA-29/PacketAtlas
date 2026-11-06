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
