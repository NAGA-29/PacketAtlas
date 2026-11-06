/** レッスンの hex 文字列('81 85 …')とバイト列の相互変換、ビット操作 */

export const HEX_PATTERN = /^([0-9A-F]{2}|…)( ([0-9A-F]{2}|…))*$/;

/** 空白区切りのトークンに分ける('…' もそのまま残す) */
export const hexTokens = (hex: string): string[] => hex.split(' ').filter((t) => t.length > 0);

/** '…' を含まない完全なバイト列か */
export const isComplete = (hex: string): boolean => !hexTokens(hex).includes('…');

/** 表示されている(省略されていない)バイト数 */
export const byteCount = (hex: string): number => hexTokens(hex).filter((t) => t !== '…').length;

/** '81 85' → Uint8Array。'…' を含む場合は例外 */
export const parseHex = (hex: string): Uint8Array => {
  const toks = hexTokens(hex);
  if (toks.includes('…')) throw new Error(`hex has elision: ${hex}`);
  return Uint8Array.from(toks.map((t) => {
    if (!/^[0-9A-F]{2}$/.test(t)) throw new Error(`bad hex token: ${t}`);
    return parseInt(t, 16);
  }));
};

/** Uint8Array → '81 85'(大文字・空白区切り) */
export const toHex = (bytes: ArrayLike<number>): string =>
  Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

/** ビッグエンディアンの符号なし整数として読む(53bitまで) */
export const readUint = (bytes: ArrayLike<number>): number => {
  let v = 0;
  for (let i = 0; i < bytes.length; i++) v = v * 256 + (bytes[i] ?? 0);
  return v;
};

/** n をビッグエンディアンの len バイトにする */
export const uintBytes = (n: number, len: number): number[] => {
  const out: number[] = [];
  let v = n;
  for (let i = 0; i < len; i++) {
    out.unshift(v % 256);
    v = Math.floor(v / 256);
  }
  if (v !== 0) throw new Error(`${n} does not fit in ${len} bytes`);
  return out;
};

/** バイト列を指定した幅のビットで切り分け、各区間の値を返す */
export const splitBits = (bytes: ArrayLike<number>, widths: number[]): number[] => {
  const bits = Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
  const total = widths.reduce((a, w) => a + w, 0);
  if (total !== bits.length) throw new Error(`bit widths ${total} != ${bits.length}`);
  let pos = 0;
  return widths.map((w) => {
    const s = bits.slice(pos, pos + w);
    pos += w;
    return parseInt(s, 2);
  });
};

/** 各区間のビット文字列('1', '0000' など) */
export const splitBitStrings = (bytes: ArrayLike<number>, widths: number[]): string[] => {
  const bits = Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
  let pos = 0;
  return widths.map((w) => {
    const s = bits.slice(pos, pos + w);
    pos += w;
    return s;
  });
};

export const ascii = (s: string): number[] => Array.from(s, (c) => {
  const code = c.charCodeAt(0);
  if (code > 0x7f) throw new Error(`non-ascii: ${c}`);
  return code;
});
