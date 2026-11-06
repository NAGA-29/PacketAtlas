// 架空フォーマット「GAME」(ゲームのネットコード章)。実在するプロトコルではない
import { ascii, uintBytes } from '../bytes';

export const PROTOCOL_ID = ascii('GAME');
export const TYPE = { INPUT: 0x01, SNAPSHOT: 0x02, FIRE: 0x03, CONNECT: 0x10, RELIABLE: 0x20 } as const;

/** 位置の量子化:1/64 m 単位の16bit整数 */
export const POS_SCALE = 64;
export const quantize = (meters: number): number => Math.round(meters * POS_SCALE);
export const dequantize = (q: number): number => q / POS_SCALE;

/** 共通ヘッダー:ID(4) + seq(2) + ack(2) + ackBits(4) + type(1) */
export const header = (o: { seq: number; ack: number; ackBits: number; type: number }): number[] => [
  ...PROTOCOL_ID,
  ...uintBytes(o.seq, 2),
  ...uintBytes(o.ack, 2),
  ...uintBytes(o.ackBits >>> 0, 4),
  o.type,
];

/** 受信済みのシーケンス番号の集合から ack と ackBits を作る(bit n = ack-1-n) */
export const ackFields = (received: number[]): { ack: number; ackBits: number } => {
  const ack = Math.max(...received);
  let bits = 0;
  for (let n = 0; n < 32; n++) if (received.includes(ack - 1 - n)) bits |= 1 << n;
  return { ack, ackBits: bits >>> 0 };
};

/** ackBits から欠けている番号を求める */
export const missing = (ack: number, ackBits: number): number[] => {
  const out: number[] = [];
  for (let n = 0; n < 32; n++) if (((ackBits >>> n) & 1) === 0) out.push(ack - 1 - n);
  return out;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** ティック(60Hz)とミリ秒 */
export const TICK_HZ = 60;
export const ticksToMs = (ticks: number): number => (ticks * 1000) / TICK_HZ;
