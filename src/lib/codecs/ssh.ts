// RFC 4251〜4254 の SSH(検証用)。暗号処理はしない
import { ascii, uintBytes } from '../bytes';

export const MSG = {
  SERVICE_REQUEST: 5,
  SERVICE_ACCEPT: 6,
  KEXINIT: 20,
  NEWKEYS: 21,
  KEX_ECDH_INIT: 30,
  KEX_ECDH_REPLY: 31,
  USERAUTH_REQUEST: 50,
  USERAUTH_SUCCESS: 52,
  CHANNEL_OPEN: 90,
  CHANNEL_OPEN_CONFIRMATION: 91,
  CHANNEL_DATA: 94,
  CHANNEL_REQUEST: 98,
} as const;

export const uint32 = (n: number): number[] => uintBytes(n >>> 0, 4);
/** string:4バイトの長さ + 中身 */
export const sshString = (data: number[] | string): number[] => {
  const b = typeof data === 'string' ? ascii(data) : data;
  return [...uint32(b.length), ...b];
};
/** name-list:カンマ区切りの string */
export const nameList = (names: string[]): number[] => sshString(names.join(','));
export const boolean = (v: boolean): number[] => [v ? 1 : 0];

/** 暗号化前のブロック長(鍵交換前は 8) */
export const MIN_BLOCK = 8;
export const MIN_PADDING = 4;

/** packet_length + padding_length + payload + padding の長さを決める */
export const paddingFor = (payloadLength: number, block = MIN_BLOCK): number => {
  let p = block - ((4 + 1 + payloadLength) % block);
  if (p < MIN_PADDING) p += block;
  return p;
};

/** バイナリパケット(MAC なし)。padding の中身は呼び出し側が渡す */
export const binaryPacket = (payload: number[], padding: number[]): number[] => [...uint32(1 + payload.length + padding.length), padding.length, ...payload, ...padding];

export interface KexInit {
  cookie: number[];
  kex: string[];
  hostKey: string[];
  encryption: string[];
  mac: string[];
  compression: string[];
}

/** KEXINIT の payload(両方向に同じ一覧を使う) */
export const kexinitPayload = (k: KexInit): number[] => [
  MSG.KEXINIT,
  ...k.cookie,
  ...nameList(k.kex),
  ...nameList(k.hostKey),
  ...nameList(k.encryption),
  ...nameList(k.encryption),
  ...nameList(k.mac),
  ...nameList(k.mac),
  ...nameList(k.compression),
  ...nameList(k.compression),
  ...nameList([]),
  ...nameList([]),
  ...boolean(false),
  ...uint32(0),
];
