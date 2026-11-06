import { describe, expect, it } from 'vitest';
import { byteCount, HEX_PATTERN, parseHex, splitBits, splitBitStrings, toHex, uintBytes } from '@/lib/bytes';

describe('bytes', () => {
  it('hex の解析と書き出し', () => {
    expect(Array.from(parseHex('81 85 0A'))).toEqual([0x81, 0x85, 0x0a]);
    expect(toHex([0x81, 0x0a])).toBe('81 0A');
    expect(() => parseHex('81 …')).toThrow();
    expect(byteCount('6A 1F … 3C')).toBe(3);
  });
  it('パターン', () => {
    expect('81 85').toMatch(HEX_PATTERN);
    expect('…').toMatch(HEX_PATTERN);
    expect('81 8a').not.toMatch(HEX_PATTERN);
    expect('818A').not.toMatch(HEX_PATTERN);
  });
  it('ビット分解', () => {
    expect(splitBits([0x81], [1, 3, 4])).toEqual([1, 0, 1]);
    expect(splitBitStrings([0xc3], [1, 1, 2, 2, 2])).toEqual(['1', '1', '00', '00', '11']);
    expect(() => splitBits([0x81], [1, 3])).toThrow();
  });
  it('整数', () => {
    expect(uintBytes(8001, 4)).toEqual([0, 0, 0x1f, 0x41]);
    expect(() => uintBytes(256, 1)).toThrow();
  });
});
