import { describe, expect, it } from 'vitest';
import { acceptKey, encodeFrame, maskPayload, OPCODE } from '@/lib/codecs/websocket';
import { flagsByte, dataOffsetByte } from '@/lib/codecs/tcp';
import { ascii, readUint, splitBits } from '@/lib/bytes';
import { allBytes, bytes, field } from '../helpers/lesson';

describe('WebSocket(RFC 6455)', () => {
  it('Sec-WebSocket-Accept は Key + GUID の SHA-1 の Base64(RFC 6455 1.3 の例)', () => {
    const key = field('websocket', 'upgrade', 'Key').text?.split(': ')[1] ?? '';
    const accept = field('websocket', 'switching', 'Accept').text?.split(': ')[1] ?? '';
    expect(acceptKey(key)).toBe(accept);
    expect(accept).toBe('s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
  });

  it('クライアントのテキストフレームはマスク付きで再計算と一致する', () => {
    const key = bytes('websocket', 'client-text', 'マスキングキー');
    const frame = encodeFrame({ opcode: OPCODE.text, payload: ascii('Hello'), maskKey: key });
    expect(allBytes('websocket', 'client-text')).toEqual(frame);
  });

  it('サーバーのテキストフレームはマスクなし', () => {
    expect(allBytes('websocket', 'server-text')).toEqual(encodeFrame({ opcode: OPCODE.text, payload: ascii('Hello') }));
  });

  it('Ping フレーム(RFC 6455 5.7 の例)', () => {
    expect(allBytes('websocket', 'ping')).toEqual(encodeFrame({ opcode: OPCODE.ping, payload: ascii('Hello') }));
  });

  it('Close 1000 をマスクした値', () => {
    const key = bytes('websocket', 'close', 'マスキングキー');
    const frame = encodeFrame({ opcode: OPCODE.close, payload: [0x03, 0xe8], maskKey: key });
    expect(allBytes('websocket', 'close')).toEqual(frame);
    expect(readUint(maskPayload(bytes('websocket', 'close', 'ステータス(マスク済み)'), key))).toBe(1000);
  });

  it('長さの符号化:125以下・16bit・64bit', () => {
    expect(encodeFrame({ opcode: 1, payload: new Uint8Array(125) }).slice(0, 2)).toEqual([0x81, 125]);
    expect(encodeFrame({ opcode: 2, payload: new Uint8Array(126) }).slice(0, 4)).toEqual([0x82, 126, 0x00, 0x7e]);
    expect(encodeFrame({ opcode: 2, payload: new Uint8Array(65536) }).slice(0, 10)).toEqual([0x82, 127, 0, 0, 0, 0, 0, 1, 0, 0]);
  });

  it('ビット分解の値:FIN=1, opcode=1 / MASK=1, len=5', () => {
    expect(splitBits(bytes('websocket', 'client-text', 'FIN + opcode'), [1, 3, 4])).toEqual([1, 0, 1]);
    expect(splitBits(bytes('websocket', 'client-text', 'MASK + 長さ'), [1, 7])).toEqual([1, 5]);
  });
});

describe('TCP(RFC 9293)', () => {
  it('SYN のポート・オフセット・フラグ', () => {
    expect(readUint(bytes('websocket', 'tcp', '送信元ポート'))).toBe(50000);
    expect(readUint(bytes('websocket', 'tcp', '宛先ポート'))).toBe(80);
    expect(bytes('websocket', 'tcp', 'データオフセット')).toEqual([dataOffsetByte(20)]);
    expect(bytes('websocket', 'tcp', 'フラグ')).toEqual([flagsByte(['SYN'])]);
  });

  it('ヘッダーの合計は20バイト', () => {
    expect(allBytes('websocket', 'tcp')).toHaveLength(20);
  });
});
