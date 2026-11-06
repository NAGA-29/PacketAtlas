// RFC 8489 STUN(検証用の最小実装)
export const MAGIC_COOKIE = 0x2112a442;
export const COOKIE_BYTES = [0x21, 0x12, 0xa4, 0x42];

export const ATTR = {
  USERNAME: 0x0006,
  MESSAGE_INTEGRITY: 0x0008,
  XOR_MAPPED_ADDRESS: 0x0020,
  PRIORITY: 0x0024,
  FINGERPRINT: 0x8028,
  ICE_CONTROLLING: 0x802a,
} as const;

/** 属性値は4バイト境界までパディングされる */
export const padded = (len: number): number => Math.ceil(len / 4) * 4;

/** 属性の TLV 全体の長さ(ヘッダー4バイト+パディング込みの値) */
export const attrSize = (valueLen: number): number => 4 + padded(valueLen);

/** XOR-MAPPED-ADDRESS(IPv4)の値部分 8 バイト */
export const xorMappedIPv4 = (ip: string, port: number): number[] => {
  const xport = port ^ (MAGIC_COOKIE >>> 16);
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4) throw new Error(`bad ip ${ip}`);
  return [0x00, 0x01, (xport >> 8) & 0xff, xport & 0xff, ...octets.map((o, i) => o ^ (COOKIE_BYTES[i] ?? 0))];
};

export const decodeXorMappedIPv4 = (value: ArrayLike<number>): { ip: string; port: number } => {
  const port = (((value[2] ?? 0) << 8) | (value[3] ?? 0)) ^ (MAGIC_COOKIE >>> 16);
  const ip = [4, 5, 6, 7].map((i, k) => (value[i] ?? 0) ^ (COOKIE_BYTES[k] ?? 0)).join('.');
  return { ip, port };
};

/** STUN の20バイトヘッダー */
export const header = (type: number, length: number, transactionId: ArrayLike<number>): number[] => {
  if (transactionId.length !== 12) throw new Error('transaction id must be 12 bytes');
  return [(type >> 8) & 0xff, type & 0xff, (length >> 8) & 0xff, length & 0xff, ...COOKIE_BYTES, ...Array.from(transactionId)];
};

/** ICE 候補の優先度(RFC 8445 5.1.2.1) */
export const candidatePriority = (typePref: number, localPref: number, componentId: number): number =>
  2 ** 24 * typePref + 2 ** 8 * localPref + (256 - componentId);
