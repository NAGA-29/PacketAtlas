import { describe, expect, it } from 'vitest';
import { decodeVarint, encodeVarint, FRAME, LONG_TYPE, longHeaderFirstByte, shortHeaderFirstByte, streamFrameType, streamKind, WT_BIDI_SIGNAL } from '@/lib/codecs/quic';
import { ascii, parseHex, readUint } from '@/lib/bytes';
import { bytes } from '../helpers/lesson';

describe('QUIC の可変長整数(RFC 9000 付録A.1 の例)', () => {
  const vectors: [string, number][] = [
    ['C2 19 7C 5E FF 14 E8 8C', 151288809941952652],
    ['9D 7F 3E 7D', 494878333],
    ['7B BD', 15293],
    ['25', 37],
    ['40 25', 37],
  ];
  for (const [hex, value] of vectors) {
    it(`${hex} → ${value}`, () => {
      const r = decodeVarint(parseHex(hex));
      // 8バイトの例は Number の精度を超えるので近似で比べる
      if (value > Number.MAX_SAFE_INTEGER) expect(r.value / value).toBeCloseTo(1, 12);
      else expect(r.value).toBe(value);
      expect(r.length).toBe(parseHex(hex).length);
    });
  }

  it('最短の符号化に戻せる', () => {
    expect(encodeVarint(37)).toEqual([0x25]);
    expect(encodeVarint(15293)).toEqual([0x7b, 0xbd]);
    expect(encodeVarint(494878333)).toEqual([0x9d, 0x7f, 0x3e, 0x7d]);
  });
});

describe('WebTransport 章のバイト列', () => {
  it('Initial の先頭バイトと長さ', () => {
    expect(bytes('webtransport', 'handshake', '先頭バイト')).toEqual([longHeaderFirstByte(LONG_TYPE.initial, 4)]);
    expect(readUint(bytes('webtransport', 'handshake', 'バージョン'))).toBe(1);
    expect(decodeVarint(bytes('webtransport', 'handshake', '長さ'))).toEqual({ value: 1182, length: 2 });
    expect(readUint(bytes('webtransport', 'handshake', '宛先CID長'))).toBe(bytes('webtransport', 'handshake', '宛先CID').length);
    expect(readUint(bytes('webtransport', 'handshake', '送信元CID長'))).toBe(bytes('webtransport', 'handshake', '送信元CID').length);
  });

  it('Initial を運ぶ UDP データグラムは 1200 バイト以上', () => {
    const headerLen = 1 + 4 + 1 + 8 + 1 + 8 + 1 + 2; // パケット番号の前まで
    expect(headerLen + 1182).toBeGreaterThanOrEqual(1200);
  });

  it('1-RTT のショートヘッダーと DATAGRAM フレーム', () => {
    expect(bytes('webtransport', 'datagram', '先頭バイト')).toEqual([shortHeaderFirstByte(4)]);
    expect(bytes('webtransport', 'datagram', 'フレーム型')).toEqual([FRAME.DATAGRAM]);
    expect(decodeVarint(bytes('webtransport', 'datagram', 'Quarter Stream ID')).value).toBe(0 / 4);
    expect(readUint(bytes('webtransport', 'datagram', 'パケット番号'))).toBe(42);
  });

  it('STREAM フレーム:型 0x0A、ストリーム4は双方向・クライアント発、長さはその後ろの合計', () => {
    expect(bytes('webtransport', 'streams', 'フレーム型')).toEqual([streamFrameType(false, true, false)]);
    const id = decodeVarint(bytes('webtransport', 'streams', 'ストリームID')).value;
    expect(streamKind(id)).toEqual({ initiator: 'client', bidi: true });
    expect(streamKind(3)).toEqual({ initiator: 'server', bidi: false });
    const body = [
      ...bytes('webtransport', 'streams', 'WTシグナル'),
      ...bytes('webtransport', 'streams', 'セッションID'),
      ...bytes('webtransport', 'streams', 'データ'),
    ];
    expect(decodeVarint(bytes('webtransport', 'streams', '長さ')).value).toBe(body.length);
    expect(decodeVarint(bytes('webtransport', 'streams', 'WTシグナル'))).toEqual({ value: WT_BIDI_SIGNAL, length: 2 });
    expect(bytes('webtransport', 'streams', 'データ')).toEqual(ascii('hi'));
  });

  it('PATH_CHALLENGE は型 0x1A と 8 バイト', () => {
    expect(bytes('webtransport', 'migration', 'フレーム型')).toEqual([FRAME.PATH_CHALLENGE]);
    expect(bytes('webtransport', 'migration', 'データ')).toHaveLength(8);
  });
});
