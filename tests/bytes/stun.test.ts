import { describe, expect, it } from 'vitest';
import { ATTR, attrSize, candidatePriority, decodeXorMappedIPv4, header, xorMappedIPv4 } from '@/lib/codecs/stun';
import { ascii, parseHex, readUint } from '@/lib/bytes';
import { allBytes, bytes, field } from '../helpers/lesson';

describe('STUN(RFC 8489 / 5769)', () => {
  it('RFC 5769 2.2 のテストベクター:192.0.2.1:32853 の XOR-MAPPED-ADDRESS', () => {
    // RFC 5769 Sample IPv4 Response より
    const value = Array.from(parseHex('00 01 A1 47 E1 12 A6 43'));
    expect(decodeXorMappedIPv4(value)).toEqual({ ip: '192.0.2.1', port: 32853 });
    expect(xorMappedIPv4('192.0.2.1', 32853)).toEqual(value);
  });

  it('Binding Success Response を再計算すると一致する', () => {
    const tid = bytes('webrtc', 'stun', 'トランザクションID');
    const attr = [0x00, ATTR.XOR_MAPPED_ADDRESS, 0x00, 0x08, ...xorMappedIPv4('203.0.113.5', 54321)];
    expect(allBytes('webrtc', 'stun')).toEqual([...header(0x0101, attr.length, tid), ...attr]);
  });

  it('XOR を外すと本文の 203.0.113.5:54321 になる', () => {
    const v = [...bytes('webrtc', 'stun', '予約 + ファミリ'), ...bytes('webrtc', 'stun', 'ポート(XOR)'), ...bytes('webrtc', 'stun', 'アドレス(XOR)')];
    expect(decodeXorMappedIPv4(v)).toEqual({ ip: '203.0.113.5', port: 54321 });
  });

  it('ICE 接続確認のメッセージ長 0x44 = 属性の合計', () => {
    const username = 'Ab3x:bXk1';
    expect(field('webrtc', 'checks', 'USERNAME').desc).toContain(username);
    const total =
      attrSize(ascii(username).length) + // USERNAME
      attrSize(4) + // PRIORITY
      attrSize(8) + // ICE-CONTROLLING
      attrSize(20) + // MESSAGE-INTEGRITY (HMAC-SHA1)
      attrSize(4); // FINGERPRINT
    expect(readUint(bytes('webrtc', 'checks', 'メッセージ長'))).toBe(total);
    expect(bytes('webrtc', 'checks', 'USERNAME')).toEqual([0x00, ATTR.USERNAME, 0x00, username.length]);
    expect(readUint(bytes('webrtc', 'checks', 'ICE-CONTROLLING').slice(0, 2))).toBe(ATTR.ICE_CONTROLLING);
    expect(readUint(bytes('webrtc', 'checks', 'FINGERPRINT').slice(0, 2))).toBe(ATTR.FINGERPRINT);
    expect(readUint(bytes('webrtc', 'checks', 'MESSAGE-INTEGRITY').slice(2))).toBe(20);
  });

  it('srflx 候補の優先度は RFC 8445 の式で作れる値', () => {
    const p = Number(field('webrtc', 'trickle', '優先度').text);
    expect(p).toBe(candidatePriority(100, 30, 1));
  });

  it('TURN ChannelData のチャネル番号は 0x4000〜0x4FFF', () => {
    const ch = readUint(bytes('webrtc', 'turn', 'チャネル番号'));
    expect(ch).toBeGreaterThanOrEqual(0x4000);
    expect(ch).toBeLessThanOrEqual(0x4fff);
    expect(readUint(bytes('webrtc', 'turn', '長さ'))).toBe(100);
  });
});
