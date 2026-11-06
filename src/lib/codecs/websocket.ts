// RFC 6455 のフレームとハンドシェイク(検証用の最小実装。テストからのみ使う)
import { createHash } from 'node:crypto';

export const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const OPCODE = { continuation: 0x0, text: 0x1, binary: 0x2, close: 0x8, ping: 0x9, pong: 0xa } as const;

/** Sec-WebSocket-Accept = Base64(SHA-1(key + GUID)) */
export const acceptKey = (key: string): string =>
  createHash('sha1').update(key + WS_GUID).digest('base64');

export const maskPayload = (payload: ArrayLike<number>, key: ArrayLike<number>): number[] =>
  Array.from(payload, (b, i) => b ^ (key[i % 4] ?? 0));

export interface FrameSpec {
  fin?: boolean;
  opcode: number;
  payload: ArrayLike<number>;
  maskKey?: ArrayLike<number>;
}

/** フレームを組み立てる。長さは 7bit / 16bit / 64bit の3通りで符号化 */
export const encodeFrame = ({ fin = true, opcode, payload, maskKey }: FrameSpec): number[] => {
  const out: number[] = [(fin ? 0x80 : 0) | (opcode & 0x0f)];
  const len = payload.length;
  const maskBit = maskKey ? 0x80 : 0;
  if (len <= 125) out.push(maskBit | len);
  else if (len <= 0xffff) out.push(maskBit | 126, (len >> 8) & 0xff, len & 0xff);
  else {
    out.push(maskBit | 127);
    let v = len;
    const ext: number[] = [];
    for (let i = 0; i < 8; i++) {
      ext.unshift(v % 256);
      v = Math.floor(v / 256);
    }
    out.push(...ext);
  }
  if (maskKey) {
    out.push(...Array.from(maskKey));
    out.push(...maskPayload(payload, maskKey));
  } else out.push(...Array.from(payload));
  return out;
};
